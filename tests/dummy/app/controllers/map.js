/**
  @module ember-flexberry-gis-dummy
*/

import Ember from 'ember';
import EditMapController from 'ember-flexberry-gis/controllers/edit-map';
import EditFormControllerOperationsIndicationMixin from '../mixins/edit-form-controller-operations-indication';

/**
  Map controller.

  @class MapController
  @extends EditMapController
  @uses EditFormControllerOperationsIndicationMixin
*/
export default EditMapController.extend(
  EditFormControllerOperationsIndicationMixin, {

    actions: {
      toggleSidebar(sidebar, context) {
        Ember.$(sidebar)
          .sidebar({
            context: Ember.$(context),
            dimPage: false,
            closable: false
          })
          .sidebar('setting', 'transition', 'overlay')
          .sidebar('toggle');
      },

      querySearch(queryString) {
        let leafletMap = this.get('leafletMap');
        let e = {
          latlng: leafletMap.getCenter(),
          searchOptions: {
            queryString,
            maxResultsCount: 10
          },
          filter(layerModel) {
            return layerModel.get('canBeSearched') && layerModel.get('visibility');
          },
          results: Ember.A()
        };

        leafletMap.fire('flexberry-map:search', e);

        this.set('searchResults', e.results);
      },

      clearSearch() {
        this.set('searchResults', null);
      }
    },

    /**
      Parent route.

      @property parentRoute
      @type String
      @default 'maps'
    */
    parentRoute: 'maps'

  });
