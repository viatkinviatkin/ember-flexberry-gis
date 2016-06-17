import __ApplicationSerializer from './application';

export default __ApplicationSerializer.extend({
  attrs: {
    layers: { serialize: false, deserialize: 'records' }
  },
  /**
  * Field name where object identifier is kept.
  */
  primaryKey: '__PrimaryKey'
});
