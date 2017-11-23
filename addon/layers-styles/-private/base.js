/**
  @module ember-flexberry-gis
*/

import Ember from 'ember';

/**
  Class implementing base stylization for vector layers.

  @class BaseLayerStyle
*/
export default Ember.Object.extend({
  /**
    Gets default style settings.

    @method getDefaultStyleSettings
    @return {Object} Hash containing default style settings.
  */
  getDefaultStyleSettings() {
    return null;
  },

  /**
    Applies layer-style to the specified leaflet layer.

    @method renderOnLeafletLayer
    @param {Object} options Method options.
    @param {<a =ref="http://leafletjs.com/reference-1.2.0.html#layer">L.Layer</a>} options.leafletLayer Leaflet layer to which layer-style must be applied.
    @param {Object} options.style Hash containing style settings.
  */
  renderOnLeafletLayer({ leafletLayer, style }) {
    throw `Method 'renderOnLeafletLayer' isn't implemented in 'base' layer-style`;
  },

  /**
    Renderes layer-style preview on the specified canvas element.

    @method renderOnCanvas
    @param {Object} options Method options.
    @param {<a =ref="https://developer.mozilla.org/ru/docs/Web/HTML/Element/canvas">Canvas</a>} options.canvas Canvas element on which layer-style preview must be rendered.
    @param {Object} options.style Hash containing style settings.
  */
  renderOnCanvas({ canvas, style }) {
    throw `Method 'renderOnCanvas' isn't implemented in 'base' layer-style`;
  }
});
