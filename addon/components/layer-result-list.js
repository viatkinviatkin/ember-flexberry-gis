/**
  @module ember-flexberry-gis
 */

import Ember from 'ember';
import layout from '../templates/components/layer-result-list';
import LeafletZoomToFeatureMixin from '../mixins/leaflet-zoom-to-feature';

// Url key used to identify transitions from ember-flexberry-gis on other resources.
const isMapLimitKey = 'GISLinked';

/**
  Component for display array of search\identify results

  @class LayerResultListComponent
  @uses LeafletZoomToFeatureMixin
  @extends <a href="http://emberjs.com/api/classes/Ember.Component.html">Ember.Component</a>
 */
export default Ember.Component.extend(LeafletZoomToFeatureMixin, {

  /**
  Service for managing map API.
  @property mapApi
  @type MapApiService
  */
  mapApi: Ember.inject.service(),

  /**
    Component's wrapping <div> CSS-classes names.

    Any other CSS-class names can be added through component's 'class' property.
    ```handlebars
    {{layer-result-list class="my-class"}}
    ```

    @property classNames
    @type String[]
    @default ['layer-result-list']
  */
  classNames: ['layer-result-list'],

  /**
    Flag indicates if intersection panel is active.

    @property intersection
    @type Boolean
    @default false
  */
  intersection: false,

  /**
    Flag indicates if layer-result-list used with favorites list.

    @property favoriteMode
    @type Boolean
    @default false
  */
  favoriteMode: false,

  /**
    Reference to component's template.
  */
  layout,

  /**
    FeatureGroup to display layer from selectedFeature.

    @property serviceLayer
    @type L.FeatureGroup
    @default null
  */
  serviceLayer: null,

  /**
    Leaflet map object for zoom and pan.

    @property leafletMap
    @type L.Map
    @default null
  */
  leafletMap: null,

  /**
    Array of results for display, each result contains object with following properties
    layerModel - MapLayer model
    features - promise for array of GeoJSON features

    @property results
    @type Ember.A()
    @default null
  */
  results: null,

  /**
    Ready results for display without promise.

    @property _displayResults
    @type Ember.A()
    @default null
  */
  _displayResults: null,

  /**
    Flag: indicates when results contains no data.

    @property _noData
    @type boolean
    @default false
  */
  _noData: false,

  /**
    Flag: indicates when one or more results.features promises rejected.

    @property _hasError
    @type boolean
    @default false
  */
  _hasError: false,

  /**
    Current selected feature.

    @property _selectedFeature
    @type GeoJSON feature
    @default null
  */
  _selectedFeature: null,

  /**
    Flag: indicates whether to display links list (if present).

    @property _linksExpanded
    @type boolean
    @default false
   */
  _linksExpanded: false,

  /**
    Action button hasListForm display.

    @property hasListForm
    @type boolean
    @default false
  */
  hasListForm: true,

  /**
    Visibility of the export dialog.

    @property exportDialogVisible
    @type boolean
    @default false
   */
  exportDialogVisible: false,

  /**
    Object to search

    @property exportResult
    @type Ember.A()
    @default null
  */
  exportResult: null,

  actions: {
    /**
      Show\hide links list (if present).
      @method actions.toggleLinks
    */
    toggleLinks() {
      this.set('_linksExpanded', !this.get('_linksExpanded'));
    },

    /**
      Process the specified method.
      @method actions.goToListForm
      @param {String} layerId Id layer
      @param {String[]} objectsIdArray Array of id objects
    */
    goToListForm(layerId, objectsIdArray) {
      const goToListFormFunc = this.get('mapApi').getFromApi('goToListForm');
      if (typeof goToListFormFunc === 'function') {
        goToListFormFunc(layerId, objectsIdArray);
      }
    },

    /**
      Action is sended to layer-result-list-action-handler.
      Action shows intersection panel.
      @method actions.findIntersection
      @param feature
    */
    findIntersection(feature) {
      this.sendAction('showIntersectionPanel', feature);
    },

    /**
      Action adds feature to favorites.

      @method actions.findIntersection
      @param feature
    */
    addToFavorite(feature) {
      this.sendAction('addToFavorite', feature);
    },

    /**
      Performs row editing.

      @method actions.editFeature
    */
    editFeature(e) {
      this.sendAction('editFeature', e);
    },

    /**
      Action adds feature to array for comparing geometries.

      @method actions.addToCompareGeometries
      @param feature
    */
    addToCompareGeometries(feature) {
      this.sendAction('addToCompareGeometries', feature);
    },

    /**
      Action zooms to intersection and shows object on map.

      @method actions.zoomToIntersection
      @param feature
    */
    zoomToIntersection(feature) {
      this.sendAction('zoomToIntersection', feature);
    },

    /**
     * Set the parameters of export and show the dialog.
     * @param {object} result Object to search.
     */
    upload(result) {
      this.set('exportResult', result);
      this.set('exportDialogVisible', true);
    }
  },

  didUpdate() {
    let _this = this;
    let $caption = this.$('.title .flexberry-toggler-caption');
    if ($caption.length > 0) {
      $caption.hover(
        function () {
          let $buttons = _this.$(this).parent().parent().parent().children('.feature-result-item-buttons');
          $buttons.removeClass('hidden');
          _this.$(this).addClass('blur');
        },
        function () {
          let $buttons = _this.$(this).parent().parent().parent().children('.feature-result-item-buttons');
          $buttons.hover(
            () => { },
            () => {
              $buttons.addClass('hidden');
              _this.$(this).removeClass('blur');
            });
        }
      );
    }
  },

  /**
     Checks model layer links and adds list and edit forms to result object.

     @method _processLayerLinkForDisplayResults
     @param {Object} searchResults
     @param {Object} displayResult
     @private
   */
  _processLayerLinkForDisplayResults(searchResults, displayResult) {
    let links = Ember.get(searchResults, 'layerModel.layerLink');
    let layerLink = links.filter(link => link.get('allowShow') === true);

    layerLink.forEach((link) => {
      if (!Ember.isBlank(link)) {
        let mos = link.get('mapObjectSetting');
        if (!Ember.isBlank(mos)) {
          let editForm = mos.get('editForm');
          if (!Ember.isBlank(editForm)) {
            let linkParameters = link.get('parameters');

            linkParameters.forEach((param) => {
              if (!Ember.isBlank(param)) {
                let queryKey = param.get('queryKey');

                if (!Ember.isBlank(queryKey)) {
                  let listForm = mos.get('listForm');
                  if (!Ember.isBlank(listForm)) {
                    displayResult.listForms.pushObject({
                      url: listForm,
                      typeName: mos.get('typeName'),
                      queryKey: queryKey
                    });
                  }

                  let layerField = param.get('layerField');
                  if (!Ember.isBlank(layerField)) {
                    displayResult.editForms.pushObject({
                      url: editForm,
                      typeName: mos.get('typeName'),
                      queryKey: queryKey,
                      layerField: layerField
                    });
                  }
                }
              }
            });
          }
        }
      }
    });
  },

  /**
    Observer for passed results
    @method _resultObserver
  */
  _resultObserver: Ember.on('init', Ember.observer('results', function () {
    this.set('_hasError', false);
    this.set('_noData', false);
    this.set('_displayResults', null);

    let results = this.get('results') || Ember.A();

    // If results had been cleared.
    if (Ember.isBlank(results)) {
      return;
    }

    this.set('_showLoader', true);

    let displayResults = Ember.A();

    // Prepare results format for template.
    results.forEach((result) => {
      if (Ember.isBlank(result.features)) {
        return;
      }

      result.features.then(
        (features) => {
          if (features.length > 0) {
            let intersectArray = features.filter((item) => {
              item.isIntersect = false;
              if (!Ember.isNone(item.intersection)) {
                item.isIntersect = true;
              }

              return !Ember.isNone(item.intersection);
            });

            let isIntersect = false;
            if (!Ember.isEmpty(intersectArray)) {
              isIntersect = true;
            }

            const hasListFormFunc = this.get('mapApi').getFromApi('hasListForm');
            const layerModel = Ember.get(result, 'layerModel');
            let hasListForm;
            if (typeof hasListFormFunc === 'function') {
              hasListForm = hasListFormFunc(layerModel.id);
            }

            let layerIds = Ember.A();
            if (hasListForm) {
              layerIds = Ember.A(features).map(feature => {
                const getLayerFeatureIdFunc = this.get('mapApi').getFromApi('getLayerFeatureId');
                if (typeof getLayerFeatureIdFunc === 'function') {
                  return getLayerFeatureIdFunc(layerModel, feature.leafletLayer);
                }

                return Ember.get(feature, 'id');
              });
            }

            let displayResult = {
              name: Ember.get(layerModel, 'name') || '',
              settings: Ember.get(layerModel, 'settingsAsObject.displaySettings.featuresPropertiesSettings'),
              displayProperties: Ember.get(layerModel, 'settingsAsObject.displaySettings.featuresPropertiesSettings.displayProperty'),
              listForms: Ember.A(),
              editForms: Ember.A(),
              features: Ember.A(features),
              layerModel: layerModel,
              hasListForm: hasListForm,
              layerIds: layerIds,
              dateFormat: Ember.get(layerModel, 'settingsAsObject.displaySettings.dateFormat'),
              isIntersect: isIntersect
            };

            this._processLayerLinkForDisplayResults(result, displayResult);
            displayResults.pushObject(displayResult);
          }
        }
      );
    });
    let getFeatureDisplayProperty = (feature, featuresPropertiesSettings, dateFormat) => {
      let displayPropertyIsCallback = Ember.get(featuresPropertiesSettings, 'displayPropertyIsCallback') === true;
      let displayProperty = Ember.get(featuresPropertiesSettings, 'displayProperty');

      if (!Ember.isArray(displayProperty) && !displayPropertyIsCallback) {
        return '';
      }

      if (Ember.typeOf(displayProperty) !== 'string' && displayPropertyIsCallback) {
        return '';
      }

      if (!displayPropertyIsCallback) {
        let featureProperties = Ember.get(feature, 'properties') || {};

        for (var prop in featureProperties) {
          let value = featureProperties[prop];
          if (value instanceof Date && !Ember.isNone(value) && !Ember.isEmpty(value) && !Ember.isEmpty(dateFormat)) {
            featureProperties[prop] = moment(value).format(dateFormat);
          }
        }

        let displayValue = Ember.none;
        displayProperty.forEach((prop) => {
          if (featureProperties.hasOwnProperty(prop)) {
            let value = featureProperties[prop];
            if (Ember.isNone(displayValue) && !Ember.isNone(value) && !Ember.isEmpty(value) && value.toString().toLowerCase() !== 'null') {
              displayValue = value;
            }
          }
        });

        return displayValue || '';
      }

      let calculateDisplayProperty = eval(`(${displayProperty})`);
      Ember.assert(
        'Property \'settings.displaySettings.featuresPropertiesSettings.displayProperty\' ' +
        'is not a valid javascript function',
        Ember.typeOf(calculateDisplayProperty) === 'function');

      return calculateDisplayProperty(feature);
    };

    let promises = results.map((result) => {
      return result.features;
    });

    Ember.RSVP.allSettled(promises).finally(() => {
      let order = 1;
      displayResults.forEach((result) => {
        result.order = order;
        result.first = result.order === 1;
        result.last = result.order === displayResults.length;
        order += 1;

        result.features = result.features.sort((a, b) => {
          // If displayValue is empty, it should be on the bottom.
          if (Ember.isBlank(a.displayValue)) {
            return 1;
          }

          if (Ember.isBlank(b.displayValue)) {
            return -1;
          }

          if (a.displayValue > b.displayValue) {
            return 1;
          }

          if (a.displayValue < b.displayValue) {
            return -1;
          }

          return 0;
        });

        if (!Ember.isBlank(result.features)) {
          let ownLayerField;
          let objectList = Ember.A();

          let editForms = result.editForms;
          let listForms = result.listForms;

          result.features.forEach((feature) => {
            Ember.set(feature, 'displayValue', getFeatureDisplayProperty(feature, result.settings, result.dateFormat));
            Ember.set(feature, 'layerModel', Ember.get(result, 'layerModel'));
            Ember.set(feature, 'editForms', Ember.A());
            if (editForms.length === 0) {
              return;
            }

            editForms.forEach((editForm) => {
              let url = editForm.url;
              let layerField = editForm.layerField;
              let queryKey = editForm.queryKey;
              let typeName = editForm.typeName;

              if (Ember.isBlank(url) || Ember.isBlank(layerField) || Ember.isBlank(queryKey)) {
                return;
              }

              let properties = feature.properties;
              let queryValue;

              if (Ember.isBlank(ownLayerField)) {
                for (var p in properties) {
                  if (properties.hasOwnProperty(p) && layerField.toLowerCase() === (p + '').toLowerCase()) {
                    ownLayerField = p;
                    break;
                  }
                }
              }

              if (!Ember.isBlank(ownLayerField)) {
                queryValue = properties[ownLayerField];
              }

              if (Ember.isBlank(queryValue)) {
                return;
              }

              let params = {};
              Ember.set(params, queryKey, queryValue);
              Ember.set(params, isMapLimitKey, true);

              feature.editForms.pushObject({
                url: url + L.Util.getParamString(params, url),
                typeName: typeName
              });

              objectList.pushObject(queryValue);
            });
          });

          let shapeIds = this._getFeatureShapeIds(result.features);
          Ember.set(result, 'shapeIds', shapeIds);

          let forms = Ember.A();
          if (objectList.length === 0 || listForms.length === 0) {
            return;
          }

          listForms.forEach((listForm) => {
            let params = {};

            Ember.set(params, isMapLimitKey, true);
            Ember.set(params, listForm.queryKey, objectList.join(','));

            forms.pushObject({
              url: listForm.url + L.Util.getParamString(params, listForm.url),
              typeName: listForm.typeName
            });
          });

          result.listForms = forms;
        }
      });

      this.set('_displayResults', displayResults);
      this.set('_noData', displayResults.length === 0);
      this.set('_showLoader', false);
      if (this.get('favoriteMode') !== true) {
        if (displayResults.length === 1) {
          this.send('zoomTo', displayResults.objectAt(0).features);
        }
      }
    });
  })),

  /**
    Get an array of layer shapes id.
    @method _getFeatureShapeIds
    @param {Object} features Layer object
    @return {String[]} Array of layer shapes id
  */
  _getFeatureShapeIds(features) {
    var shapeIds = [];
    features.forEach((feature) => {
      let shapeId;
      const getLayerFeatureIdFunc = this.get('mapApi').getFromApi('getLayerFeatureId');
      if (typeof getLayerFeatureIdFunc === 'function') {

        //Need to implement id definition function
        shapeId = getLayerFeatureIdFunc(feature.layerModel, feature.leafletLayer);
      } else {
        shapeId = feature.id;
      }

      shapeIds.push(shapeId);
    });
    return shapeIds;
  }
});
