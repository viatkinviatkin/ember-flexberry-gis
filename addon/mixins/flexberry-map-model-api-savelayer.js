import { set, get } from '@ember/object';
import { isNone } from '@ember/utils';
import { all, Promise } from 'rsvp';
import Mixin from '@ember/object/mixin';

export default Mixin.create({
  saveLayers(layersIds) {
    return all(layersIds.map((layerId) => this.saveLayer(layerId)));
  },

  /**
    Save layer.
    @method saveLayer
    @param {string} layerId Layer id.
    @throws {Error}
    @return {Ember.RSVP.Promise} Returns promise.
  */
  saveLayer(layerId) {
    const [layerModel, leafletObject] = this._getModelLeafletObject(layerId);

    if (isNone(leafletObject)) {
      return new Promise(() => {
        throw new Error('Layer type not supported');
      });
    }

    return new Promise((resolve, reject) => {
      const saveSuccess = (data) => {
        set(leafletObject, '_wasChanged', false);
        const map = this.get('mapApi').getFromApi('leafletMap');

        if (!isNone(map)) {
          // Remove layer editing.
          this.disableLayerEditing(map);
        }

        leafletObject.off('save:failed', saveFailed);
        resolve({
          layerModel,
          newFeatures: data.layers,
        });
      };

      const saveFailed = (data) => {
        leafletObject.off('save:success', saveSuccess);
        reject(data);
      };

      leafletObject.once('save:success', saveSuccess);
      leafletObject.once('save:failed', saveFailed);
      leafletObject.save();
    });
  },

  /**
    Remove layer editing.
    @method _removeLayerEditing
    @param {Object} map Map.
    @private
  */
  disableLayerEditing(map) {
    map.eachLayer(function (object) {
      const enabled = get(object, 'editor._enabled');
      if (enabled === true) {
        object.disableEdit();
      }
    });
    map.off('editable:editing');
  },
});
