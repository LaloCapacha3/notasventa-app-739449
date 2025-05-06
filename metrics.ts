import AWS from 'aws-sdk';
import os from 'os';

// Configurar cliente CloudWatch
const cloudWatch = new AWS.CloudWatch({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Ambiente para etiquetar las métricas
const ambiente = process.env.NODE_ENV || 'local';

export function createMetricsService() {
  // Contador de peticiones HTTP por código de respuesta
  const incrementHttpCounter = async (statusCode: string) => {
    try {
      await cloudWatch.putMetricData({
        Namespace: 'CatalogoApp',
        MetricData: [
          {
            MetricName: 'HttpRequests',
            Dimensions: [
              {
                Name: 'StatusCode',
                Value: statusCode
              },
              {
                Name: 'Environment',
                Value: ambiente
              }
            ],
            Unit: 'Count',
            Value: 1
          }
        ]
      }).promise();
      console.log(`Métrica registrada para código de respuesta ${statusCode}`);
    } catch (error) {
      console.error('Error al registrar métrica en CloudWatch:', error);
    }
  };

  // Registro de tiempo de respuesta de endpoints
  const recordResponseTime = async (milliseconds: number, endpoint: string) => {
    try {
      await cloudWatch.putMetricData({
        Namespace: 'CatalogoApp',
        MetricData: [
          {
            MetricName: 'EndpointResponseTime',
            Dimensions: [
              {
                Name: 'Endpoint',
                Value: endpoint
              },
              {
                Name: 'Environment',
                Value: ambiente
              }
            ],
            Unit: 'Milliseconds',
            Value: milliseconds
          }
        ]
      }).promise();
      console.log(`Tiempo de respuesta registrado para ${endpoint}: ${milliseconds}ms`);
    } catch (error) {
      console.error('Error al registrar tiempo de respuesta en CloudWatch:', error);
    }
  };

  return {
    incrementHttpCounter,
    recordResponseTime
  };
} 