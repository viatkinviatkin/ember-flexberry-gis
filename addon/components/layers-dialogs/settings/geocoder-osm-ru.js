/**
  @module ember-flexberry-gis
*/

import Component from '@ember/component';
import layout from '../../../templates/components/layers-dialogs/settings/geocoder-osm-ru';

/**
  Settings-part of Geocoder OSM.ru layer modal dialog.

  @class GeocoderOsmRuLayerSettingsComponent
  @extends <a href="http://emberjs.com/api/classes/Ember.Component.html">Ember.Component</a>
*/
export default Component.extend({

  /**
    Reference to component's template.
  */
  layout,

  /**
    Overridden ['tagName'](http://emberjs.com/api/classes/Ember.Component.html#property_tagName)
    is empty to disable component's wrapping <div>.

    @property tagName
    @type String
    @default ''
  */
  tagName: '',

  /**
    Editing layer deserialized type-related settings.

    @property settings
    @type Object
    @default null
  */
  settings: null
});
