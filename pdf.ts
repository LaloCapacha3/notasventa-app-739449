import PDFDocument from 'pdfkit';

export const generarPDFNotaVenta = async (nota: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
            bufferPages: true
        });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Estilos y constantes
        const colorPrimario = '#333333';
        const colorSecundario = '#666666';
        const colorFondo = '#f9f9f9';
        const colorBorde = '#dddddd';
        const anchoTabla = 500;
        const margenIzq = 50;
        
        // Columnas de la tabla con ancho ajustable
        const colProductoId = 230; // Aumentado para productos con IDs largos
        const colPrecioUnit = 90;
        const colCantidad = 70;
        const colImporte = 110;
        
        // Función helper para formatear moneda
        const formatoMoneda = (valor: number) => `$${valor}`;
        
        // Función para texto con salto de línea automático
        const textoConSalto = (texto: string, x: number, y: number, ancho: number, opciones = {}) => {
            const palabras = texto.toString().split(' ');
            let linea = '';
            let altoTexto = 0;
            const altoLinea = 12; // Alto de cada línea
            
            palabras.forEach(palabra => {
                const testLinea = linea.length === 0 ? palabra : `${linea} ${palabra}`;
                const anchoTexto = doc.widthOfString(testLinea);
                
                if (anchoTexto > ancho) {
                    doc.text(linea, x, y + altoTexto, opciones);
                    linea = palabra;
                    altoTexto += altoLinea;
                } else {
                    linea = testLinea;
                }
            });
            
            if (linea.length > 0) {
                doc.text(linea, x, y + altoTexto, opciones);
                altoTexto += altoLinea;
            }
            
            return altoTexto;
        };

        // Logo y encabezado
        doc.fontSize(24)
           .fillColor(colorPrimario)
           .font('Helvetica-Bold')
           .text('NOTA DE VENTA', { align: 'center' });
        
        doc.fontSize(12)
           .font('Helvetica')
           .text(`ID: ${nota.id}`, { align: 'center' });
        
        doc.moveDown(1.5);

        // Recuadro para información del cliente
        const inicioInfoCliente = doc.y;
        
        // Dibujar el fondo del recuadro
        doc.rect(margenIzq, inicioInfoCliente, anchoTabla, 150)
           .fillAndStroke(colorFondo, colorBorde);
        
        doc.y = inicioInfoCliente + 10; // Margen superior dentro del recuadro
        
        // Información del cliente - Título
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(colorPrimario)
           .text('Información General', margenIzq + 15, doc.y);
        
        doc.moveDown(0.5);
        
        // Datos del cliente en formato de dos columnas
        const col1 = margenIzq + 15;
        const col2 = margenIzq + anchoTabla / 2 + 15;
        
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(colorPrimario)
           .text('Cliente ID:', col1, doc.y);
        
        doc.font('Helvetica')
           .fillColor(colorSecundario)
           .text(nota.clienteId, col1 + 70, doc.y);
        
        doc.moveDown(1);
        
        // Dirección de Facturación
        const yFacturacion = doc.y;
        
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(colorPrimario)
           .text('Dirección de Facturación:', col1, yFacturacion);
        
        doc.font('Helvetica')
           .fillColor(colorSecundario);
           
        let y = yFacturacion + 15;
        
        // Mostrar cada campo de la dirección de facturación en líneas separadas
        doc.text(`Domicilio: ${nota.direccionFacturacion.domicilio}`, col1, y);
        y += 12;
        doc.text(`Colonia: ${nota.direccionFacturacion.colonia}`, col1, y);
        y += 12;
        doc.text(`Municipio: ${nota.direccionFacturacion.municipio}`, col1, y);
        y += 12;
        doc.text(`Estado: ${nota.direccionFacturacion.estado}`, col1, y);
        
        // Dirección de Envío
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(colorPrimario)
           .text('Dirección de Envío:', col2, yFacturacion);
        
        doc.font('Helvetica')
           .fillColor(colorSecundario);
           
        y = yFacturacion + 15;
        
        // Mostrar cada campo de la dirección de envío en líneas separadas
        doc.text(`Domicilio: ${nota.direccionEnvio.domicilio}`, col2, y);
        y += 12;
        doc.text(`Colonia: ${nota.direccionEnvio.colonia}`, col2, y);
        y += 12;
        doc.text(`Municipio: ${nota.direccionEnvio.municipio}`, col2, y);
        y += 12;
        doc.text(`Estado: ${nota.direccionEnvio.estado}`, col2, y);
        
        // Ajustar el cursor vertical para comenzar después del recuadro
        doc.y = inicioInfoCliente + 160;
        
        // Sección de productos
        doc.moveDown(1);
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor(colorPrimario)
           .text('Detalle de Productos', { align: 'center' });
        
        doc.moveDown(1);

        // Tabla de productos
        if (nota.productos && nota.productos.length > 0) {
            // Encabezados de la tabla con fondo
            const yEncabezado = doc.y;
            
            // Fondo para encabezados
            doc.rect(margenIzq, yEncabezado - 5, anchoTabla, 20)
               .fillAndStroke('#e6e6e6', colorBorde);
            
            doc.fontSize(10)
               .font('Helvetica-Bold')
               .fillColor(colorPrimario);
            
            doc.text('Producto ID', margenIzq + 5, yEncabezado);
            doc.text('Precio Unitario', margenIzq + colProductoId + 5, yEncabezado);
            doc.text('Cantidad', margenIzq + colProductoId + colPrecioUnit + 5, yEncabezado);
            doc.text('Importe', margenIzq + colProductoId + colPrecioUnit + colCantidad + 5, yEncabezado);
            
            doc.moveDown(1);
            
            // Filas de productos
            doc.font('Helvetica')
               .fontSize(9)
               .fillColor(colorSecundario);
            
            let colorAlternado = false;
            let posY = doc.y;
            
            nota.productos.forEach((producto: any, index: number) => {
                // Verificar si necesitamos una nueva página
                if (posY > doc.page.height - 150) {
                    doc.addPage();
                    posY = 50;
                    
                    // Repetir encabezados en la nueva página
                    doc.rect(margenIzq, posY - 5, anchoTabla, 20)
                       .fillAndStroke('#e6e6e6', colorBorde);
                    
                    doc.fontSize(10)
                       .font('Helvetica-Bold')
                       .fillColor(colorPrimario);
                    
                    doc.text('Producto ID', margenIzq + 5, posY);
                    doc.text('Precio Unitario', margenIzq + colProductoId + 5, posY);
                    doc.text('Cantidad', margenIzq + colProductoId + colPrecioUnit + 5, posY);
                    doc.text('Importe', margenIzq + colProductoId + colPrecioUnit + colCantidad + 5, posY);
                    
                    posY += 25;
                    
                    doc.font('Helvetica')
                       .fontSize(9)
                       .fillColor(colorSecundario);
                }
                
                // Calcular altura de la fila actual
                const productoIdHeight = doc.heightOfString(producto.productoId || 'N/A', {
                    width: colProductoId - 10,
                    align: 'left'
                });
                
                const alturaFila = Math.max(productoIdHeight, 20);
                
                // Dibujar fondo alternado para las filas
                if (colorAlternado) {
                    doc.rect(margenIzq, posY - 5, anchoTabla, alturaFila + 10)
                       .fill(colorFondo);
                }
                
                // Dibujar bordes de la celda
                doc.strokeColor(colorBorde)
                   .lineWidth(0.5)
                   .rect(margenIzq, posY - 5, anchoTabla, alturaFila + 10)
                   .stroke();
                
                doc.strokeColor(colorBorde)
                   .moveTo(margenIzq + colProductoId, posY - 5)
                   .lineTo(margenIzq + colProductoId, posY + alturaFila + 5)
                   .stroke();
                
                doc.strokeColor(colorBorde)
                   .moveTo(margenIzq + colProductoId + colPrecioUnit, posY - 5)
                   .lineTo(margenIzq + colProductoId + colPrecioUnit, posY + alturaFila + 5)
                   .stroke();
                
                doc.strokeColor(colorBorde)
                   .moveTo(margenIzq + colProductoId + colPrecioUnit + colCantidad, posY - 5)
                   .lineTo(margenIzq + colProductoId + colPrecioUnit + colCantidad, posY + alturaFila + 5)
                   .stroke();
                
                // Escribir datos del producto
                doc.fillColor(colorSecundario);
                
                // ProductoID con manejo de texto largo
                textoConSalto(producto.productoId || 'N/A', margenIzq + 5, posY, colProductoId - 10);
                
                // Resto de datos
                doc.text(formatoMoneda(producto.precioUnitario || 0), margenIzq + colProductoId + 5, posY);
                doc.text(producto.cantidad?.toString() || '0', margenIzq + colProductoId + colPrecioUnit + 5, posY);
                doc.text(formatoMoneda(producto.importe || 0), margenIzq + colProductoId + colPrecioUnit + colCantidad + 5, posY);
                
                // Incrementar posición vertical para la siguiente fila
                posY += alturaFila + 10;
                colorAlternado = !colorAlternado;
            });
            
            // Total
            doc.y = posY + 10;
            doc.moveDown(0.5);
            
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .fillColor(colorPrimario)
               .text(`Total: ${formatoMoneda(nota.totalNota || 0)}`, margenIzq, doc.y, { align: 'right' });
        } else {
            doc.fontSize(10)
               .font('Helvetica-Oblique')
               .fillColor(colorSecundario)
               .text('No hay productos en esta nota de venta', { align: 'center' });
        }
        
        // Fecha de generación
        doc.moveDown(3);
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(colorSecundario)
           .text(`Generado el: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}`, margenIzq, doc.y, { align: 'center' });
        
        doc.end();
    });
}; 