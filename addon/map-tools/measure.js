/**
  @module ember-flexberry-gis
*/

import Ember from 'ember';
import BaseMapTool from './base';

/**
  Measure map-tool.

  @class MeasureMapTool
  @extends BaseMapTool
*/
export default BaseMapTool.extend({
  /**
    Leaflet.Editable.Measure tools instance.

    @property _measureTools
    @type Object
    @default null
    @private
  */
  _measureTools: null,

  /**
    Layer group for Leaflet.Editable temporary markers & other objects.

    @property editLayer
    @type <a href="http://leafletjs.com/reference-1.0.0.html#layergroup">L.LayerGroup</a>
    @default null
  */
  editLayer: null,

  /**
    Layer group for Leaflet.Editable drawn features.

    @property featuresLayer
    @type <a href="http://leafletjs.com/reference-1.0.0.html#layergroup">L.LayerGroup</a>
    @default null
  */
  featuresLayer: null,

  /**
    Flag: indicates whether map-tool is exclusive or not.
    Exclusive map-tool lives in enabled state until some other tool will be manually enabled.

    @property enabled
    @type Boolean
    @default false
  */
  exclusive: false,

  /**
    Enables tool.

    @method _enable
    @private
  */
  _enable() {
    this._super(...arguments);

    let leafletMap = this.get('leafletMap');
    let editLayer = this.get('editLayer');
    if (!Ember.isNone(editLayer) && !leafletMap.hasLayer(editLayer)) {
      editLayer.addTo(leafletMap);
    }

    let featuresLayer = this.get('featuresLayer');
    if (!Ember.isNone(featuresLayer) && !leafletMap.hasLayer(featuresLayer)) {
      featuresLayer.addTo(leafletMap);
    }

    let measureTools = this.get('_measureTools');
    if (Ember.isNone(measureTools)) {
      measureTools = new L.MeasureBase(leafletMap, {
        editOptions: {
          editLayer: editLayer,
          featuresLayer: featuresLayer
        }
      });
      this.set('_measureTools', measureTools);
    }

    // Disable tool when measure will be created.
    leafletMap.on('measure:created', this.disable, this);
  },

  /**
    Disables tool.

    @method _disable
    @private
  */
  _disable() {
    this._super(...arguments);

    let leafletMap = this.get('leafletMap');
    if (!Ember.isNone(leafletMap)) {
      leafletMap.off('measure:created', this.disable, this);
    }

    let measureTools = this.get('_measureTools');
    if (!Ember.isNone(measureTools)) {
      measureTools.stopMeasuring();
    }
  },

  /**
    Destroys map-tool.
  */
  willDestroy() {
    this._super(...arguments);

    let editLayer = this.get('_measureTools.options.editOptions.editLayer');
    if (!Ember.isNone(editLayer)) {
      editLayer.clearLayers();
      editLayer.remove();
    }

    let featuresLayer = this.get('_measureTools.options.editOptions.featuresLayer');
    if (!Ember.isNone(featuresLayer)) {
      featuresLayer.clearLayers();
      featuresLayer.remove();
    }

    this.set('editLayer', null);
    this.set('featuresLayer', null);
    this.set('_measureTools', null);
  }
});
