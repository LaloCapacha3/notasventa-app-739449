import express, { Request, Response } from 'express';
import AWS from 'aws-sdk';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { generarPDFNotaVenta } from './pdf';
import { v4 as uuidv4 } from 'uuid';
import { createMetricsService } from './metrics';
import fetch from 'node-fetch';


// Cargar variables de entorno
dotenv.config();

// Configuración de AWS
AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

// Configuración de tablas de DynamoDB
const DYNAMO_TABLE_NOTAS_VENTA = process.env.DYNAMO_TABLE_NOTAS_VENTA || 'examen-1-notas-de-venta';
const DYNAMO_TABLE_CONTENIDO_NOTAS_VENTA = process.env.DYNAMO_TABLE_CONTENIDO_NOTAS_VENTA || 'examen-1-contenido-de-nota-de-venta';
const DYNAMO_TABLE_DOMICILIOS = process.env.DYNAMO_TABLE_DOMICILIOS || 'examen-1-domicilios';
const DYNAMO_TABLE_PRODUCTOS = process.env.DYNAMO_TABLE_PRODUCTOS || 'examen-1-producto';
const BUCKET_NAME = '739449-esi3898l-examen1';

// URL del servicio de notificaciones
const NOTIFICACIONES_SERVICE_URL = process.env.NOTIFICACIONES_SERVICE_URL || 'http://98.81.87.1:3002';

// Inicializar Express
const app = express();
app.use(bodyParser.json());

// Servicio de métricas
const metricsService = createMetricsService();

// ENDPOINT PARA CREAR CONTENIDO DE NOTA DE VENTA
app.post('/contenido-de-nota-de-venta', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'POST /contenido-de-nota-de-venta';
    let { clienteId, productoId, cantidad } = req.body;
    const id = uuidv4();

    try {
        const productoParams = {
            TableName: DYNAMO_TABLE_PRODUCTOS,
            Key: { id: productoId }
        };

        const productoData = await dynamoDb.get(productoParams).promise();

        if (!productoData.Item) {
            res.status(404).json({ error: 'Producto no encontrado' });
            metricsService.incrementHttpCounter('4xx');
            return; 
        }
        
        cantidad = parseFloat(cantidad);
        const precioUnitario = productoData.Item.precioBase;
        const importe = cantidad * precioUnitario;
        
        const contenidoParams = {
            TableName: DYNAMO_TABLE_CONTENIDO_NOTAS_VENTA,
            Item: { id, clienteId, productoId, cantidad, precioUnitario, importe }
        };

        await dynamoDb.put(contenidoParams).promise();

        res.status(201).json({ id, message: 'Contenido de la nota de venta creado' });
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error al crear contenido de la nota de venta:', error);
        res.status(500).json({ error: 'Error al crear contenido de la nota de venta', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

// Función para enviar notificación al servicio de notificaciones
async function notificarCreacionNotaVenta(notaVentaId: string, clienteId: string): Promise<void> {
    try {
        const downloadLink = `${process.env.API_URL || 'http://localhost:3001'}/notas-de-venta/${notaVentaId}`;
        
        const response = await fetch(`${NOTIFICACIONES_SERVICE_URL}/notificar-venta`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                notaVentaId,
                clienteId,
                downloadLink
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json() as { error?: string };
            throw new Error(`Error al notificar: ${errorData.error || response.statusText}`);
        }
        
        console.log(`Notificación enviada para nota de venta ${notaVentaId}`);
    } catch (error) {
        console.error('Error al enviar notificación:', error);
        // No fallamos el proceso principal si falla la notificación
    }
}

// ENDPOINT PARA CREAR NOTA DE VENTA
app.post('/notas-de-venta', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'POST /notas-de-venta';
    const { clienteId } = req.body;
    const id = uuidv4();

    try {
        const paramsConsultaDirecciones = {
            TableName: DYNAMO_TABLE_DOMICILIOS,
            FilterExpression: 'clienteId = :clienteId',
            ExpressionAttributeValues: { ':clienteId': clienteId }
        };

        const resultadoDirecciones = await dynamoDb.scan(paramsConsultaDirecciones).promise();
        const direcciones = resultadoDirecciones.Items || [];

        const direccionFacturacion = direcciones.find(d => d.tipoDireccion === 'facturacion') || {};
        const direccionEnvio = direcciones.find(d => d.tipoDireccion === 'envio');

        if (!direccionEnvio) {
            res.status(400).json({ error: 'El cliente debe tener una dirección de envío registrada' });
            metricsService.incrementHttpCounter('4xx');
            return;
        }

        const paramsConsultaProductos = {
            TableName: DYNAMO_TABLE_CONTENIDO_NOTAS_VENTA,
            FilterExpression: 'clienteId = :clienteId',
            ExpressionAttributeValues: { ':clienteId': clienteId }
        };

        const resultadoProductos = await dynamoDb.scan(paramsConsultaProductos).promise();
        const productos = resultadoProductos.Items || [];

        const totalNota = productos.reduce((sum, producto) => sum + (producto.importe || 0), 0);

        const datosFacturacion = {
            colonia: direccionFacturacion.colonia || direccionEnvio.colonia,
            domicilio: direccionFacturacion.domicilio || direccionEnvio.domicilio,
            estado: direccionFacturacion.estado || direccionEnvio.estado,
            municipio: direccionFacturacion.municipio || direccionEnvio.municipio
        };

        const datosEnvio = {
            colonia: direccionEnvio.colonia,
            domicilio: direccionEnvio.domicilio,
            estado: direccionEnvio.estado,
            municipio: direccionEnvio.municipio
        };

        const notaVenta = { 
            id, 
            clienteId, 
            direccionFacturacion: datosFacturacion, 
            direccionEnvio: datosEnvio, 
            totalNota,
            productos,
            fechaCreacion: new Date().toISOString()
        };

        const params = {
            TableName: DYNAMO_TABLE_NOTAS_VENTA,
            Item: notaVenta
        };

        await dynamoDb.put(params).promise();
        
        // Generar PDF de la nota de venta
        const pdfBuffer = await generarPDFNotaVenta(notaVenta);

        // Subir PDF a S3
        const s3Params = {
            Bucket: BUCKET_NAME,
            Key: `${id}.pdf`,
            Body: pdfBuffer,
            Metadata: { 'leido-por-correo': 'false' },
            ContentType: 'application/pdf'
        };

        await s3.putObject(s3Params).promise();

        // Notificar al servicio de notificaciones usando fetch
        notificarCreacionNotaVenta(id, clienteId);

        // Limpiar los productos del contenido de nota de venta
        const paramsEliminarContenido = {
            TableName: DYNAMO_TABLE_CONTENIDO_NOTAS_VENTA,
        };

        const contenidoResultado = await dynamoDb.scan(paramsEliminarContenido).promise();
        const itemsToDelete = contenidoResultado.Items?.filter(item => item.clienteId === clienteId) || [];

        for (const item of itemsToDelete) {
            const deleteParams = {
                TableName: DYNAMO_TABLE_CONTENIDO_NOTAS_VENTA,
                Key: { 
                    id: item.id
                }
            };
            await dynamoDb.delete(deleteParams).promise();
        }

        res.status(201).json({ 
            id, 
            message: 'Nota de venta creada y PDF generado', 
            totalNota,
            pdfUrl: `${process.env.API_URL || 'http://localhost:3001'}/notas-de-venta/${id}`,
            clienteId
        });
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error al crear nota de venta:', error);
        res.status(500).json({ error: 'Error al crear nota de venta', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

// ENDPOINT PARA DESCARGAR NOTA DE VENTA
app.get('/notas-de-venta/:id', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = `GET /notas-de-venta/${req.params.id}`;
    const { id } = req.params;

    const s3Params = {
        Bucket: BUCKET_NAME,
        Key: `${id}.pdf`
    };

    try {
        const s3Data = await s3.getObject(s3Params).promise();

        const s3UpdateParams = {
            Bucket: BUCKET_NAME,
            Key: `${id}.pdf`,
            Metadata: { 'leido-por-correo': 'true' },
            CopySource: `/${BUCKET_NAME}/${id}.pdf`,
            MetadataDirective: 'REPLACE'
        };

        await s3.copyObject(s3UpdateParams).promise();

        res.setHeader('Content-Disposition', `attachment; filename="notaventa-${id}.pdf"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(s3Data.Body);
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error al descargar nota de venta:', error);
        res.status(500).json({ error: 'Error al descargar nota de venta', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

// ENDPOINT PARA OBTENER TODAS LAS NOTAS DE VENTA
app.get('/notas-de-venta', async (req: Request, res: Response) => {
    const { clienteId } = req.query;
    const params: any = {
        TableName: DYNAMO_TABLE_NOTAS_VENTA,
    };

    if (clienteId) {
        params.FilterExpression = "clienteId = :clienteId";
        params.ExpressionAttributeValues = {
            ":clienteId": clienteId
        };
    }

    try {
        const data = await dynamoDb.scan(params).promise();
        res.json(data.Items);
    } catch (error) {
        console.error('Error al obtener notas de venta:', error);
        res.status(500).json({ error: 'Error al obtener notas de venta', details: error });
    }
});

// Iniciar servidor
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Servicio de notas de venta ejecutándose en puerto ${port}`);
}); 