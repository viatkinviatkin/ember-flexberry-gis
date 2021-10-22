/**
  @module ember-flexberry-gis
*/

import Component from '@ember/component';
import layout from '../../templates/components/markers-styles/default';

/**
  Component containing GUI for 'dafault' markers-style

  @class DefaultMarkersStyleComponent
  @extends <a href="http://emberjs.com/api/classes/Ember.Component.html">Ember.Component</a>
*/
export default Component.extend({
  /**
    Reference to component's template.
  */
  layout,

  /**
    Hash containing style settings.

    @property styleSettings
    @type Object
    @default null
  */
  styleSettings: null,
});
