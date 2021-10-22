/**
  @module ember-flexberry-gis
 */

import { isNone } from '@ember/utils';

import { observer } from '@ember/object';
import Component from '@ember/component';

import LeafletOptionsMixin from 'ember-flexberry-gis/mixins/leaflet-options';

/**
  BaseControl component for leaflet map controls
  @class BaseControlComponent
  @extends <a href="http://emberjs.com/api/classes/Ember.Component.html">Ember.Component</a>
  @uses LeafletOptionsMixin
*/
export default Component.extend(LeafletOptionsMixin, {
  /**
    Leaflet map for this control.

    @property leafletMap
    @type L.Map
    @default null
  */
  leafletMap: null,

  /**
    Conrol's position inside map.
    Possible values are: 'topleft', 'topright', 'bottomleft' or 'bottomright'.

    @property position
    @type String
  */
  position: undefined,

  /**
    Overload wrapper tag name for disabling wrapper.
  */
  tagName: '',

  /**
    Leaflet control object.

    @property control
    @type Object
    @default null
  */
  control: null,

  /**
    Initializes component's DOM-related properties.
  */
  didInsertElement() {
    this._super(...arguments);

    this.initControl();
  },

  /**
    Destroys component's DOM-related properties.
  */
  willDestroyElement() {
    this.destroyControl();

    this._super(...arguments);
  },

  /**
    Creates control instance, should be overridden in child classes.

    @method createControl
    @return {L.Control} Returns new created control
  */
  createControl() {
  },

  /**
    After creates control instance, should be overridden in child classes.

    @method afterCreateControl
  */
  afterCreateControl() {
  },

  /**
    Adds created control to map if it's present or change.

    @method initControl
  */
  initControl: observer('leafletMap', function () {
    const leafletMap = this.get('leafletMap');
    if (!isNone(leafletMap)) {
      const control = this.createControl();
      this.set('control', control);

      leafletMap.addControl(control);
      this.afterCreateControl();
    }
  }),

  /**
    Removes created control from map if it's present.

    @method initControl
  */
  destroyControl() {
    const leafletMap = this.get('leafletMap');
    const control = this.get('control');
    if (!isNone(leafletMap) && !isNone(control)) {
      leafletMap.removeControl(control);
    }

    this.set('control', null);
  },
});
