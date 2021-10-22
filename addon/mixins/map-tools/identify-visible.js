/**
  @module ember-flexberry-gis
*/

import { get } from '@ember/object';

import { A, isArray } from '@ember/array';
import Mixin from '@ember/object/mixin';

/**
  Mixin for identify-visible map tools.

  @class IdentifyVisibleMixin
  @extends <a href="http://emberjs.com/api/classes/Ember.Mixin.html">Ember.Mixin</a>
*/
export default Mixin.create({
  /**
    Returns flat array of layers satisfying to current identification mode.

    @method _getLayersToIdentify
    @param {Object} options Method options.
    @param {Object[]} options.excludedLayers Layers that must be excluded from identification.
    @returns {Object[]} Flat array of layers satisfying to current identification mode.
    @private
  */
  _getLayersToIdentify({ excludedLayers }) {
    excludedLayers = A(excludedLayers || []);

    let getVisibleLayersToIdentify = (layers) => {
      let result = A();

      if (isArray(layers)) {
        layers.forEach((layer) => {
          let layerIsVisible = get(layer, 'visibility') === true;
          if (get(layer, 'canBeIdentified') && layerIsVisible && !excludedLayers.contains(layer)) {
            result.pushObject(layer);
          }

          // If parent layer is invisible then all child layers are invisible too,
          // so there is no need to check them.
          if (!layerIsVisible) {
            return result;
          }

          let childLayers = get(layer, 'layers');
          result.pushObjects(getVisibleLayersToIdentify(childLayers));
        });
      }

      return result;
    };

    let rootLayers = this.get('layers');
    return getVisibleLayersToIdentify(rootLayers);
  }
});
