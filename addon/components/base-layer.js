/**
  @module ember-flexberry-gis
 */

import Ember from 'ember';
import DynamicPropertiesMixin from 'ember-flexberry-gis/mixins/dynamic-properties';
import LeafletOptionsMixin from 'ember-flexberry-gis/mixins/leaflet-options';
import LeafletPropertiesMixin from 'ember-flexberry-gis/mixins/leaflet-properties';

const { assert } = Ember;

/**
  BaseLayer component for other flexberry-gis layers.
  @class BaseLayerComponent
  @extends <a href="http://emberjs.com/api/classes/Ember.Component.html">Ember.Component</a>
 */
export default Ember.Component.extend(
  DynamicPropertiesMixin,
  LeafletOptionsMixin,
  LeafletPropertiesMixin,
  {
    /**
      Overload wrapper tag name for disabling wrapper.
     */
    tagName: '',

    /**
      Leaflet container for this layer.
      @property container
      @type L.Map|L.LayerGroup
      @default null
     */
    container: null,

    /**
      This layer index, used for layer ordering in Map.
      @property index
      @type Int
      @default null
     */
    index: null,

    /**
      Call leaflet layer setZIndex if it presents.
      @method setZIndex
     */
    setZIndex: Ember.observer('index', function () {
      let layer = this.get('_layer');
      if (layer && layer.setZIndex) {
        layer.setZIndex(this.get('index'));
      }
    }),

    /**
      Leaflet layer object init by settings from model.
      @property _layer
      @type L.Layer
      @default null
      @private
     */
    _layer: undefined,

    /**
      Flag, indicates visible or not current layer on map.
      @property visibility
      @type Boolean
      @default null
     */
    visibility: null,

    /**
      Switch layer visible on map based on visibility property.
      @method toggleVisible
     */
    toggleVisible: Ember.observer('visibility', function () {
      Ember.assert('Try to change layer visibility without container', this.get('container'));
      if (this.get('visibility')) {
        this.get('container').addLayer(this.get('_layer'));
      }
      else {
        this.get('container').removeLayer(this.get('_layer'));
      }
    }),

    /**
      Create leaflet layer, should be overriden in child classes.
      @method createLayer
     */
    createLayer() {
      assert('BaseLayer\'s `createLayer` should be overriden.');
    },

    init() {
      this._super(...arguments);
      this.set('_layer', this.createLayer());
      this._addObservers();
    },

    didInsertElement() {
      this._super(...arguments);
      this.toggleVisible();
      this.setZIndex();
    }
  });
