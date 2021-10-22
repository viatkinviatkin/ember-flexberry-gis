/**
  @module ember-flexberry-gis
*/

import $ from 'jquery';
import WfsFilterParserMixin from '../mixins/wfs-filter-parser';
import VectorLayer from './-private/vector';

/**
  Class describing WFS layer metadata.

  @class WfsLayer
  @extends VectorLayer
*/
export default VectorLayer.extend(WfsFilterParserMixin, {
  /**
    Creates new settings object (with settings related to layer-type).

    @method createSettings
    @returns {Object} New settings object (with settings related to layer-type).
  */
  createSettings() {
    const settings = this._super(...arguments);
    $.extend(true, settings, {
      crs: undefined,
      showExisting: undefined,
      geometryField: undefined,
      url: undefined,
      version: undefined,
      typeNS: undefined,
      typeName: undefined,
      typeNSName: undefined,
      maxFeatures: undefined,
      format: undefined,
      namespaceUri: undefined,
      readonly: undefined,
      forceMulti: undefined,
      withCredentials: false,
    });

    return settings;
  },
});
