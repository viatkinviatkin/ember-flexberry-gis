/**
  @module ember-flexberry-gis
*/

import { isNone } from '@ember/utils';

import Mixin from '@ember/object/mixin';
import { computed } from '@ember/object';
import { run } from '@ember/runloop';

/**
  Leaflet events mixin.
  Listens to leaflet events & send related actions.

  @class LeafletEventsMixin
  @uses <a href="http://emberjs.com/api/classes/Ember.Mixin.html">Ember.Mixin</a>
*/
export default Mixin.create({
  /**
    Array of leaflet object events on which component should raise action.

    @property leafletEvents
    @type Array
    @default null
  */
  leafletEvents: null,

  /**
    Array of handlers for used leaflet object events.

    @property _eventHandlers
    @type Array
    @default null
    @private
  */
  _eventHandlers: null,

  /**
    Array of event names for which is present action or methodName.

    @property usedLeafletEvents
    @type String[]
  */
  usedLeafletEvents: computed('leafletEvents', function () {
    return (this.get('leafletEvents') || []).filter((eventName) => {
      const methodName = `_${eventName}`;
      const actionName = eventName;
      return this.get(methodName) !== undefined || this.get(actionName) !== undefined;
    });
  }),

  /**
    Add subscribe to leaflet object for all specified and used events.

    @method _addEventListeners
  */
  _addEventListeners() {
    const eventHandlers = {};
    this.get('usedLeafletEvents').forEach((eventName) => {
      const actionName = eventName;
      const methodName = `_${eventName}`;

      // Create an event handler that runs the function inside an event loop.
      eventHandlers[eventName] = function (e) {
        run.schedule('actions', this, function () {
          this.sendAction(actionName, e);

          // Allow classes to add custom logic on events as well.
          if (typeof this[methodName] === 'function') {
            run(this, this[methodName], e);
          }
        });
      };

      this.get('_leafletObject').addEventListener(eventName, eventHandlers[eventName], this);
    });

    this.set('_eventHandlers', eventHandlers);
  },

  /**
    Remove all event listeners from leaflet object.

    @method _removeEventListeners
  */
  _removeEventListeners() {
    const eventHandlers = this.get('_eventHandlers');
    const leafletObject = this.get('_leafletObject');
    if (isNone(eventHandlers) || isNone(leafletObject)) {
      return;
    }

    this.get('usedLeafletEvents').forEach((eventName) => {
      leafletObject.removeEventListener(eventName,
        eventHandlers[eventName], this);
      delete eventHandlers[eventName];
    });
  },

  /**
    Removes attached event listeners on destroy.
  */
  willDestroyElement() {
    this._super(...arguments);
    this._removeEventListeners();
  },
});
