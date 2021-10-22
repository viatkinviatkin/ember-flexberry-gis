/**
  @module ember-flexberry-gis
*/

import $ from 'jquery';

import Mixin from '@ember/object/mixin';

/**
  Mixin which injects map-commands methods & properties into leaflet map.

  @class LeafletMapCommandsMixin
  @extends <a href="http://emberjs.com/api/classes/Ember.Mixin.html">Ember.Mixin</a>
*/
export default Mixin.create({
  /**
    Performs some initialization before leaflet map will be initialized.

    @param {Object} leafletMap Leaflet map.
  */
  willInitLeafletMap(leafletMap) {
    this._super(...arguments);

    // Define flexberryMap.commands namespace & related methods & properties.
    leafletMap.flexberryMap.sidebar = {

      // Hide sidebar.
      hide() {
        const $control = $('*[class$="sidebar-wrapper"],*[class*="sidebar-wrapper "]');
        if ($control.length === 1 && $control.hasClass('visible')) {
          leafletMap.fire('flexberry-map:toggleSidebar');
        }
      },

      // Show sidebar.
      show() {
        const $control = $('*[class$="sidebar-wrapper"],*[class*="sidebar-wrapper "]');
        if ($control.length === 1 && !$control.hasClass('visible')) {
          leafletMap.fire('flexberry-map:toggleSidebar');
        }
      },
    };
  },

  /**
    Performs some clean up before leaflet map will be destroyed.

    @param {Object} leafletMap Leaflet map.
  */
  willDestroyLeafletMap(leafletMap) {
    this._super(...arguments);
  },
});
