// tracing.js - Implementação simplificada
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

function setupOpenTelemetry() {
  try {
    console.log('Inicializando OpenTelemetry...');
    
    // Defina um recurso com informações do seu serviço
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'observability-demo-app',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    });

    // Configure exportadores OTLP
    const traceExporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
    });

    const metricExporter = new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
    });

    // Crie e configure o SDK
    const sdk = new NodeSDK({
      resource,
      traceExporter,
      metricExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Desabilitar instrumentações específicas que podem causar problemas
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          '@opentelemetry/instrumentation-net': { enabled: false },
        }),
      ],
    });

    // Iniciar o SDK
    sdk.start();
    console.log('OpenTelemetry inicializado com sucesso');

    // Encerre o SDK quando o programa terminar
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => console.log('SDK encerrado com sucesso'))
        .catch((error) => console.log('Erro ao encerrar SDK', error))
        .finally(() => process.exit(0));
    });

    return sdk;
  } catch (error) {
    console.error('Erro ao configurar OpenTelemetry:', error);
    return null;
  }
}

module.exports = { setupOpenTelemetry };