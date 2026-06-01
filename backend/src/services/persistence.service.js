const {
  Device,
  Event,
  AccessLog,
  OverrideRequest,
  TelemetrySummary,
} = require('../models');
const { getDatabaseStatus } = require('../config/database');
const {
  mapAcceptedIngestionToPersistence,
} = require('./ingestionPersistence.mapper');
const modelsByName = {
  Device,
  Event,
  AccessLog,
  OverrideRequest,
  TelemetrySummary,
};
function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}
function serializeDocument(document) {
  if (!document) {
    return null;
  }
  if (typeof document.toObject === 'function') {
    return document.toObject();
  }
  return document;
}
async function persistMappedOperation(mappedOperation) {
  if (!isDatabaseConnected()) {
    return {
      saved: false,
      skipped: true,
      reason: 'database_not_connected',
      database: getDatabaseStatus(),
    };
  }
  const Model = modelsByName[mappedOperation.model];
  if (!Model) {
    return {
      saved: false,
      skipped: false,
      reason: 'unknown_model',
      model: mappedOperation.model,
    };
  }
  try {
    if (mappedOperation.kind === 'document') {
      const savedDocument = await mappedOperation.document.save();
      return {
        saved: true,
        skipped: false,
        kind: 'document',
        model: mappedOperation.model,
        id: savedDocument._id,
        document: serializeDocument(savedDocument),
      };
    }
    if (mappedOperation.kind === 'update') {
      const updatedDocument = await Model.findOneAndUpdate(
        mappedOperation.filter,
        mappedOperation.update,
        {
          ...mappedOperation.options,
          runValidators: true,
        }
      );
      if (!updatedDocument) {
        return {
          saved: false,
          skipped: false,
          kind: 'update',
          model: mappedOperation.model,
          reason: 'target_not_found',
          filter: mappedOperation.filter,
        };
      }
      return {
        saved: true,
        skipped: false,
        kind: 'update',
        model: mappedOperation.model,
        id: updatedDocument._id,
        document: serializeDocument(updatedDocument),
      };
    }
    return {
      saved: false,
      skipped: false,
      reason: 'unsupported_operation_kind',
      kind: mappedOperation.kind,
    };
  } catch (error) {
    return {
      saved: false,
      skipped: false,
      reason: 'persistence_error',
      error: error.message,
      model: mappedOperation.model,
      kind: mappedOperation.kind,
    };
  }
}
async function persistAcceptedIngestion(ingestionResult) {
  const mappedOperation = mapAcceptedIngestionToPersistence(ingestionResult);
  return persistMappedOperation(mappedOperation);
}
module.exports = {
  persistMappedOperation,
  persistAcceptedIngestion,
};
