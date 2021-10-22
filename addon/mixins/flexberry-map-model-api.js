import $ from 'jquery';
import { later } from '@ember/runloop';
import { getOwner } from '@ember/application';
import { A, isArray } from '@ember/array';
import { get } from '@ember/object';
import { isNone, isEmpty } from '@ember/utils';
import { Promise, allSettled, all } from 'rsvp';
import { inject as service } from '@ember/service';
import Mixin from '@ember/object/mixin';
import distance from 'npm:@turf/distance';
import helpers from 'npm:@turf/helpers';
import booleanContains from 'npm:@turf/boolean-contains';
import area from 'npm:@turf/area';
import intersect from 'npm:@turf/intersect';
import ClipperLib from 'npm:clipper-lib';
import jsts from 'npm:jsts';
import { getLeafletCrs } from '../utils/leaflet-crs';
import html2canvasClone from '../utils/html2canvas-clone';
import state from '../utils/state';
import SnapDraw from './snap-draw';
import { geometryToJsts } from '../utils/layer-to-jsts';
import { downloadFile, downloadBlob } from '../utils/download-file';
import { getCrsByName } from '../utils/get-crs-by-name';

export default Mixin.create(SnapDraw, {
  /**
    Service for managing map API.
    @property mapApi
    @type MapApiService
  */
  mapApi: service(),

  /**
    Shows layers specified by IDs.

    @method showLayers.
    @param {Array} layerIds Array of layer IDs.
    @return {Promise}
  */
  showLayers(layerIds) {
    return this._setVisibility(layerIds, true);
  },

  /**
    Hides layers specified by IDs.

    @method hideLayers.
    @param {Array} layerIds Array of layer IDs.
    @return nothing
  */
  hideLayers(layerIds) {
    return this._setVisibility(layerIds, false);
  },

  /**
    Shows objects for layer.

    @method showLayerObjects
    @param {string} layerId Layer id.
    @param {string[]} objectIds Array of objects IDs.
    @return nothing
  */
  showLayerObjects(layerId, objectIds) {
    return this._setVisibilityObjects(layerId, objectIds, true);
  },

  /**
    Hides objects for layer.

    @method hideLayerObjects
    @param {string} layerId Layer id.
    @param {Array} objectIds Array of objects IDs.
    @return nothing
  */
  hideLayerObjects(layerId, objectIds) {
    return this._setVisibilityObjects(layerId, objectIds, false);
  },

  /**
    Show all layer objects.

    @method showAllLayerObjects
    @param {string} layerId Layer id.
    @return {Promise}
  */
  showAllLayerObjects(layerId) {
    return new Promise((resolve, reject) => {
      const layer = this.get('mapLayer').findBy('id', layerId);
      if (isNone(layer)) {
        reject(`Layer '${layerId}' not found.`);
      }

      const leafletObject = get(layer, '_leafletObject');
      if (!isNone(leafletObject) && typeof leafletObject.showAllLayerObjects === 'function') {
        leafletObject.showAllLayerObjects().then((result) => {
          resolve(result);
        });
      } else {
        resolve('Is not a vector layer');
      }
    });
  },

  /**
    Hide all layer objects.

    @method hideAllLayerObjects
    @param {string} layerId Layer id.
    @return nothing
  */
  hideAllLayerObjects(layerId) {
    const layer = this.get('mapLayer').findBy('id', layerId);
    if (isNone(layer)) {
      throw `Layer '${layerId}' not found.`;
    }

    const leafletObject = get(layer, '_leafletObject');
    if (!isNone(leafletObject) && typeof leafletObject.hideAllLayerObjects === 'function') {
      leafletObject.hideAllLayerObjects();
    } else {
      throw 'Is not a vector layer';
    }
  },

  /**
    Creates new layer with specified options.
    @method createNewLayer.
    @param {Object} options
    @return Layer ID.
  */
  createNewLayer(options) {
    options = options || {};
    const store = this.get('store');
    const layer = store.createRecord('new-platform-flexberry-g-i-s-map-layer', options);
    layer.set('map', this);
    return layer.save().then(() => {
      const layers = this.get('hierarchy');
      layers.addObject(layer);
      return layer.get('id');
    });
  },

  /**
    Remove object from layer.
    @method deleteLayerObject.
    @param {String} layerId Layer ID.
    @param {String} featureId Object ID.
    @return Promise.
  */
  deleteLayerObject(layerId, featureId) {
    this.deleteLayerObjects(layerId, [featureId]);
  },

  /**
    Remove shapes from layer.
    @method deleteLayerObjects.
    @param {string} layerId Layer ID.
    @param {Object[]} featureIds Array of objects IDs.
    @return Promise.
  */
  deleteLayerObjects(layerId, featureIds) {
    return new Promise((resolve, reject) => {
      const ids = [];
      this._getModelLayerFeature(layerId, featureIds, true).then(([layer, leafletObject]) => {
        leafletObject.eachLayer(function (shape) {
          const id = this._getLayerFeatureId(layer, shape);

          if (!isNone(id) && featureIds.indexOf(id) !== -1) {
            ids.push(id);
            leafletObject.removeLayer(shape);
          }
        }.bind(this));

        const deleteLayerFromAttrPanelFunc = this.get('mapApi').getFromApi('_deleteLayerFromAttrPanel');
        ids.forEach((id) => {
          if (typeof deleteLayerFromAttrPanelFunc === 'function') {
            deleteLayerFromAttrPanelFunc(id, layer);
          }
        });
        resolve();
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    Gets intersected features.
    @method getIntersectionObjects
    @param {Object} feature GeoJson Feature.
    @param {string} crsName Name of coordinate reference system, in which to give coordinates.
    @param {Array} layerIds Array of layers IDs.
    @return {Promise} Array of layers and objects which intersected selected object.
  */
  getIntersectionObjects(feature, crsName, layerIds) {
    return new Promise((resolve, reject) => {
      if (!isNone(feature) && feature.hasOwnProperty('geometry')) {
        const leafletMap = this.get('mapApi').getFromApi('leafletMap');
        const layersIntersect = [];
        layerIds.forEach((id) => {
          const layer = this.get('mapLayer').findBy('id', id);
          if (!isNone(layer)) {
            if (layer.get('settingsAsObject.identifySettings.canBeIdentified')) {
              layersIntersect.push(layer);
            }
          }
        });

        const crs = crsName || 'EPSG:4326';
        const featureCrs = crs === 'EPSG:4326' ? feature : this._convertObjectCoordinates(crs, feature);
        const featureLayer = L.GeoJSON.geometryToLayer(featureCrs);
        const latlng = featureLayer instanceof L.Marker || featureLayer instanceof L.CircleMarker
          ? featureLayer.getLatLng() : featureLayer.getBounds().getCenter();
        const e = {
          latlng,
          polygonLayer: featureLayer,
          bufferedMainPolygonLayer: featureLayer,
          excludedLayers: [],
          layers: layersIntersect,
          results: A(),
        };

        if (e.layers.length > 0) {
          leafletMap.fire('flexberry-map:identify', e);
        }

        e.results = isArray(e.results) ? e.results : A();
        const promises = A();

        // Handle each result.
        // Detach promises from already received features.
        e.results.forEach((result) => {
          if (isNone(result)) {
            return;
          }

          promises.pushObject(get(result, 'features'));
        });

        // Wait for all promises to be settled & call '_finishIdentification' hook.
        allSettled(promises).then(() => {
          resolve(e.results);
        });
      }
    });
  },

  /**
    Get the nearest object
    @method getNearObject
    @param {string} layerId Layer ID of the selected object.
    @param {string} layerObjectId Object ID of the selected object.
    @param {Array} layerIds Array of layers IDs in which to search.
    @return {Promise} Object constains distance, layer and layer object.
  */
  getNearObject(layerId, layerObjectId, layerIds) {
    return new Promise((resolve, reject) => {
      this._getModelLayerFeature(layerId, [layerObjectId]).then(([, leafletObject, layerObject]) => {
        const leafletMap = this.get('mapApi').getFromApi('leafletMap');
        const layersGetNeatObject = [];
        layerIds.forEach((id) => {
          const layer = this.get('mapLayer').findBy('id', id);
          layersGetNeatObject.push(layer);
        });

        const e = {
          featureLayer: layerObject[0],
          featureId: layerObjectId,
          layerObjectId: layerId,
          layers: layersGetNeatObject,
          results: A(),
        };

        if (e.layers.length > 0) {
          leafletMap.fire('flexberry-map:getNearObject', e);
        }

        e.results = isArray(e.results) ? e.results : A();
        const promises = A();

        // Handle each result.
        // Detach promises from already received features.
        e.results.forEach((result) => {
          if (isNone(result)) {
            return;
          }

          promises.pushObject(get(result, 'features'));
        });

        allSettled(promises).then((results) => {
          const rejected = results.filter((item) => item.state === 'rejected').length > 0;
          if (rejected) {
            return reject('Failed to get nearest object');
          }

          let res = null;
          results.forEach((item) => {
            if (isNone(res) || item.value.distance < res.distance) {
              res = item.value;
            }
          });
          resolve(res);
        });
      });
    });
  },

  getObjectCenter(object) {
    const type = get(object, 'feature.geometry.type');
    if (type === 'Point') {
      return object._latlng;
    }

    return object.getBounds().getCenter();
  },

  /**
    Get distance between objects
    @method _getDistanceBetweenObjects
    @param {Object} firstLayerObject First layer object.
    @param {Object} secondLayerObject Second layer object.
    @return {number} Distance between objects in meters.
  */
  _getDistanceBetweenObjects(firstLayerObject, secondLayerObject) {
    const firstPoint = this.getObjectCenter(firstLayerObject);
    const firstObject = helpers.point([firstPoint.lat, firstPoint.lng]);

    const secondPoint = this.getObjectCenter(secondLayerObject);
    const secondObject = helpers.point([secondPoint.lat, secondPoint.lng]);

    // Get distance in meters.
    return distance.default(firstObject, secondObject, { units: 'kilometers', }) * 1000;
  },

  /**
    Get distance between objects
    @method getDistanceBetweenObjects
    @param {string} firstLayerId First layer id.
    @param {string} firstLayerObjectId First layer object id.
    @param {string} secondLayerId Second layer id.
    @param {string} secondLayerObjectId Second layer object id.
    @return {Promise} Distance between objects in meters.
  */
  getDistanceBetweenObjects(firstLayerId, firstLayerObjectId, secondLayerId, secondLayerObjectId) {
    return new Promise((resolve, reject) => {
      all([
        this._getModelLayerFeature(firstLayerId, [firstLayerObjectId]),
        this._getModelLayerFeature(secondLayerId, [secondLayerObjectId])
      ]).then((result) => {
        const objA = result[0][2][0];
        const objB = result[1][2][0];
        resolve(this._getDistanceBetweenObjects(objA, objB));
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    Get layer object attributes and coordinates.
    @method getLayerObjectOptions
    @param {String} layerId Layer ID.
    @param {String} featureId Object ID.
    @param {String} crsName Name of coordinate reference system, in which to give coordinates.
    @return {Promise} Attributes and coordinates
  */
  getLayerObjectOptions(layerId, featureId, crsName) {
    return new Promise((resolve, reject) => {
      let result;
      this._getModelLayerFeature(layerId, [featureId]).then(([, leafletLayer, features]) => {
        const featureLayer = features[0];
        if (leafletLayer && featureLayer) {
          result = Object.assign({}, featureLayer.feature.properties);
          if (crsName) {
            const NewObjCrs = this._convertObjectCoordinates(leafletLayer.options.crs.code, featureLayer.feature, crsName);
            result.geometry = NewObjCrs.geometry.coordinates;
          } else {
            result.geometry = featureLayer.feature.geometry.coordinates;
          }

          const jstsGeoJSONReader = new jsts.io.GeoJSONReader();
          const featureLayerGeoJSON = featureLayer.toProjectedGeoJSON(leafletLayer.options.crs);
          const jstsGeoJSON = jstsGeoJSONReader.read(featureLayerGeoJSON);
          result.area = jstsGeoJSON.geometry.getArea();
          resolve(result);
        }
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    Check if object A contains object B.
    @method isContainsObject
    @param {String} layerAId First layer ID.
    @param {String} objectAId First object ID.
    @param {String} layerBId Second layer ID.
    @param {String} objectBId Second object ID.
    @return {Promise} true or false.
  */
  isContainsObject(layerAId, objectAId, layerBId, objectBId) {
    return new Promise((resolve, reject) => {
      all([
        this._getModelLayerFeature(layerAId, [objectAId]),
        this._getModelLayerFeature(layerBId, [objectBId])
      ]).then((result) => {
        const objA = result[0][2][0].feature;
        const objB = result[1][2][0].feature;
        const leafletLayerA = result[0][1];
        const leafletLayerB = result[1][1];
        if (objA && objB && leafletLayerA && leafletLayerB) {
          let feature1 = leafletLayerA.options.crs.code === 'EPSG:4326' ? objA : this._convertObjectCoordinates(leafletLayerA.options.crs.code, objA);
          let feature2 = leafletLayerB.options.crs.code === 'EPSG:4326' ? objB : this._convertObjectCoordinates(leafletLayerB.options.crs.code, objB);

          if (feature1.geometry.type === 'MultiPolygon') {
            feature1 = L.polygon(feature1.geometry.coordinates[0]).toGeoJSON();
          }

          if (feature2.geometry.type === 'MultiPolygon') {
            feature2 = L.polygon(feature2.geometry.coordinates[0]).toGeoJSON();
          }

          resolve(booleanContains(feature1, feature2));
        }
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    Calculate the area of ​​object B that extends beyond the boundaries of object A.
    @method getAreaExtends
    @param {String} layerAId First layer ID.
    @param {String} objectAId First object ID.
    @param {String} layerBId Second layer ID.
    @param {String} objectBId Second object ID.
    @return {Promise} Area
  */
  getAreaExtends(layerAId, objectAId, layerBId, objectBId) {
    return new Promise((resolve, reject) => {
      all([
        this._getModelLayerFeature(layerAId, [objectAId]),
        this._getModelLayerFeature(layerBId, [objectBId])
      ]).then((result) => {
        const objA = result[0][2][0].feature;
        const objB = result[1][2][0].feature;
        const layerObjectA = result[0][1];
        const layerObjectB = result[1][1];
        const feature1 = layerObjectA.options.crs.code === 'EPSG:4326' ? objA : this._convertObjectCoordinates(layerObjectA.options.crs.code, objA);
        const feature2 = layerObjectB.options.crs.code === 'EPSG:4326' ? objB : this._convertObjectCoordinates(layerObjectB.options.crs.code, objB);
        const intersectionRes = intersect.default(feature2, feature1);
        if (intersectionRes) {
          const resultArea = area(feature2) - area(intersectionRes);
          resolve(resultArea);
        } else {
          resolve(area(feature2));
        }
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    Get layer type.
    @method _getTypeLayer
    @param {Object} layerModel layer model.
    @return {Object} layer type
  */
  _getTypeLayer(layerModel) {
    const className = get(layerModel, 'type');
    const layerType = getOwner(this).knownForType('layer', className);
    return layerType;
  },

  _setVisibility(layerIds, visibility = false) {
    return new Promise((resolve, reject) => {
      if (isArray(layerIds)) {
        const leafletMap = this.get('mapApi').getFromApi('leafletMap');
        const currentLayerIds = [];
        layerIds.forEach((id) => {
          const layer = this.get('mapLayer').findBy('id', id);
          if (layer) {
            layer.set('visibility', visibility);
            currentLayerIds.push(id);
          } else {
            later(this, () => { reject(`Layer '${id}' not found.`); }, 1);
          }
        });
        if (visibility) {
          if (currentLayerIds.length > 0) {
            const e = {
              layers: currentLayerIds,
              results: A(),
            };
            leafletMap.fire('flexberry-map:moveend', e);
            e.results = isArray(e.results) ? e.results : A();
            const promises = A();
            e.results.forEach((result) => {
              if (isNone(result)) {
                return;
              }

              promises.pushObject(get(result, 'promise'));
            });

            allSettled(promises).then(() => {
              later(this, () => { resolve('success'); }, 1);
            });
          } else {
            later(this, () => { reject('all layerIds is not found'); }, 1);
          }
        } else {
          later(this, () => { resolve('success'); }, 1);
        }
      } else {
        reject('Parametr is not a Array');
      }
    });
  },

  /**
    Get object id by object and layer.

    @method _getLayerFeatureId
    @param {Object} layer Layer.
    @param {Object} layerObject Object.
    @return {number} Object ID.
  */
  _getLayerFeatureId(layer, layerObject) {
    const field = this._getPkField(layer);
    if (layerObject.state !== state.insert) {
      if (layerObject.feature.properties.hasOwnProperty(field)) {
        return get(layerObject, `feature.properties.${field}`);
      }

      return get(layerObject, 'feature.id');
    }

    return null;
  },

  /**
    Determine the visibility of the specified objects by id for the layer.

    @method _setVisibilityObjects
    @param {string} layerId Layer ID.
    @param {string[]} objectIds Array of objects IDs.
    @param {boolean} [visibility=false] visibility Object Visibility.
    @return {Ember.RSVP.Promise}
  */
  _setVisibilityObjects(layerId, objectIds, visibility = false) {
    return new Promise((resolve, reject) => {
      if (isArray(objectIds)) {
        const [layer, leafletObject] = this._getModelLeafletObject(layerId);
        if (isNone(layer)) {
          return reject(`Layer '${layerId}' not found.`);
        }

        if (!isNone(leafletObject) && typeof leafletObject._setVisibilityObjects === 'function') {
          leafletObject._setVisibilityObjects(objectIds, visibility).then((result) => {
            resolve(result);
          });
        } else {
          return reject('Layer type not supported');
        }
      }
    });
  },

  /**
    To copy Object from Source layer to Destination.
    @method copyObject
    @param {Object} source Object with source settings
    {
      layerId, //{string} Layer ID
      objectId, //{string} Object ID
      shouldRemove //{Bool} Should remove object from source layer
    }
    @param {Object} destination Object with destination settings
    {
      layerId, //{string} Layer ID
      properties //{Object} Properties of new object.
    }
    @return {Promise} Object in Destination layer
  */
  copyObject(source, destination) {
    return new Promise((resolve, reject) => {
      this._getModelLayerFeature(source.layerId, [source.objectId], source.shouldRemove).then(([, sourceLeafletLayer, obj]) => {
        const sourceFeature = obj[0];
        const [destLayerModel, destLeafletLayer] = this._getModelLeafletObject(destination.layerId);
        let destFeature;
        switch (destLayerModel.get('settingsAsObject.typeGeometry').toLowerCase()) {
          case 'polygon':
            destFeature = L.polygon(sourceFeature.getLatLngs());
            break;
          case 'polyline':
            destFeature = L.polyline(sourceFeature.getLatLngs());
            break;
          case 'marker':
            destFeature = L.marker(sourceFeature.getLatLng());
            break;
          default:
            reject(`Unknown layer type: '${destLayerModel.get('settingsAsObject.typeGeometry')}`);
        }

        if (!isNone(destFeature)) {
          destFeature.feature = {
            properties: Object.assign({}, sourceFeature.feature.properties, destination.properties || {}),
          };

          if (sourceLeafletLayer.geometryField) {
            delete destFeature.feature.properties[sourceLeafletLayer.geometryField];
          }

          if (destLeafletLayer.geometryField) {
            delete destFeature.feature.properties[destLeafletLayer.geometryField];
          }

          const e = { layers: [destFeature], results: A(), };
          destLeafletLayer.fire('load', e);

          allSettled(e.results).then(() => {
            if (source.shouldRemove) {
              sourceLeafletLayer.removeLayer(sourceFeature);
            }

            resolve(destFeature);
          });
        }
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    To copy Objects from Source layer to Destination.
    @method copyObjectsBatch
    @param {Object} source Object with source settings
    {
      layerId, //{string} Layer ID
      objectIds, //{array} Objects ID
      shouldRemove //{Bool} Should remove object from source layer
    }
    @param {Object} destination Object with destination settings
    {
      layerId, //{string} Layer ID
      withProperties //{Bool} To copy objects with it properties.
    }
    @return {Promise} Object in Destination layer
  */
  copyObjectsBatch(source, destination) {
    return new Promise((resolve, reject) => {
      if (isNone(source.layerId) || isNone(source.objectIds) || isNone(destination.layerId)) {
        reject('Check the parameters you are passing');
      } else {
        const loadPromise = new all(this.loadingFeaturesByPackages(source.layerId, source.objectIds, source.shouldRemove));

        loadPromise.then((res) => {
          const destFeatures = [];
          const sourceFeatures = [];
          const [destLayerModel, destLeafletLayer] = this._getModelLeafletObject(destination.layerId);
          const [sourceModel, sourceLeafletLayer] = this._getModelLeafletObject(source.layerId);
          let objects = [];
          if (source.shouldRemove) {
            sourceLeafletLayer.eachLayer((shape) => {
              if (source.objectIds.indexOf(this._getLayerFeatureId(sourceModel, shape)) !== -1) {
                objects.push(shape);
              }
            });
          } else {
            res.forEach((result) => {
              objects = objects.concat(result[2]);
            });
          }

          objects.forEach((sourceFeature) => {
            let destFeature;
            switch (destLayerModel.get('settingsAsObject.typeGeometry').toLowerCase()) {
              case 'polygon':
                destFeature = L.polygon(sourceFeature.getLatLngs());
                break;
              case 'polyline':
                destFeature = L.polyline(sourceFeature.getLatLngs());
                break;
              case 'marker':
                destFeature = L.marker(sourceFeature.getLatLng());
                break;
              default:
                reject(`Unknown layer type: '${destLayerModel.get('settingsAsObject.typeGeometry')}`);
            }

            if (!isNone(destFeature)) {
              destFeature.feature = { properties: {}, };
              if (destination.withProperties) {
                destFeature.feature.properties = Object.assign({}, sourceFeature.feature.properties);

                if (sourceLeafletLayer.geometryField) {
                  delete destFeature.feature.properties[sourceLeafletLayer.geometryField];
                }

                if (destLeafletLayer.geometryField) {
                  delete destFeature.feature.properties[destLeafletLayer.geometryField];
                }
              }

              destFeatures.push(destFeature);
              if (source.shouldRemove) {
                sourceFeatures.push(sourceFeature);
              }
            }
          });

          const e = { layers: destFeatures, results: A(), };
          destLeafletLayer.fire('load', e);

          allSettled(e.results).then(() => {
            if (source.shouldRemove) {
              sourceFeatures.forEach((sourceFeature) => {
                sourceLeafletLayer.removeLayer(sourceFeature);
              });
            }

            resolve(destFeatures);
          });
        }).catch((e) => reject(e));
      }
    });
  },

  /**
    Calculate the area of intersection between object A and objects in array B.
    @method getIntersectionArea
    @param {String} layerAId First layer ID.
    @param {String} objectAId First object ID.
    @param {String} layerBId Second layer ID.
    @param {Array} objectBIds Array of object IDs in second layer.
    @param {Bool} showOnMap flag indicates if intersection area will be displayed on map.
    @return {Promise} If showOnMap = true, return objects, which show on map in serviceLayer, and area, else only area.
  */
  getIntersectionArea(layerAId, objectAId, layerBId, objectBIds, showOnMap) {
    return new Promise((resolve, reject) => {
      const result = A();
      all([
        this._getModelLayerFeature(layerAId, [objectAId]),
        this._getModelLayerFeature(layerBId, objectBIds)
      ]).then((res) => {
        const layerObjectA = res[0][1];
        const layerObjectB = res[1][1];
        const objA = res[0][2][0].feature;
        const feature1 = layerObjectA.options.crs.code === 'EPSG:4326' ? objA : this._convertObjectCoordinates(layerObjectA.options.crs.code, objA);
        const featuresB = res[1][2];
        featuresB.forEach((feat) => {
          const objB = feat.feature;
          const feature2 = layerObjectB.options.crs.code === 'EPSG:4326' ? objB : this._convertObjectCoordinates(layerObjectB.options.crs.code, objB);
          const intersectionRes = intersect.default(feature1, feature2);
          if (intersectionRes) {
            const object = {
              id: objB.properties.primarykey,
              area: area(intersectionRes),
            };
            if (showOnMap) {
              const obj = L.geoJSON(intersectionRes, {
                style: { color: 'green', },
              });
              const serviceLayer = this.get('mapApi').getFromApi('serviceLayer');
              obj.addTo(serviceLayer);
              object.objectIntesect = obj;
            }

            result.pushObject(object);
          } else {
            result.pushObject({
              id: objB.properties.primarykey,
              area: 'Intersection not found',
            });
          }
        });
        if (!isNone(result)) {
          resolve(result);
        }
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    Cleans the service layer.
    @method clearServiceLayer
    @return nothing
  */
  clearServiceLayer() {
    const serviceLayer = this.get('mapApi').getFromApi('serviceLayer');
    serviceLayer.clearLayers();
  },

  /**
    Create image for layer object.
    @method  getSnapShot
    @param {Object} source Object with settings
    {
      layerId, //{string} Layer ID.
      objectId, //{string} Object ID.
      layerArrIds, //{Array} Array of layers IDs.
      options {
        width, //{number} width image
        height //{number} height image
      }
    }
    @return {Promise} Image url.
  */
  getSnapShot({
    layerId, objectId, layerArrIds, options,
  }) {
    return new Promise((resolve, reject) => {
      this._getModelLayerFeature(layerId, [objectId]).then(([layerModel, leafletObject, featureLayer]) => {
        const allLayers = this.get('mapLayer.canonicalState');
        const allLayersIds = allLayers.map((l) => l.id);
        if (layerArrIds) {
          const showLayersIds = layerArrIds;
          showLayersIds.push(layerId);

          this.showLayers(showLayersIds);
          const hideLayersIds = allLayersIds.filter((i) => showLayersIds.indexOf(i) < 0);
          this.hideLayers(hideLayersIds);
        }

        const leafletMap = this.get('mapApi').getFromApi('leafletMap');

        const $mapPicture = $(leafletMap._container);
        const heightMap = $mapPicture.height();
        const widthMap = $mapPicture.width();
        let heightNew = heightMap;
        let widthNew = widthMap;
        if (!isNone(options)) {
          heightNew = isNone(options.height) ? heightMap : options.height;
          widthNew = isNone(options.width) ? widthMap : options.width;
        }

        $mapPicture.height(heightNew);
        $mapPicture.width(widthNew);

        const load = [];
        const ids = isEmpty(layerArrIds) ? allLayersIds : layerArrIds;
        if (ids) {
          ids.forEach((lid) => {
            if (lid !== layerId) {
              const [, layerObject] = this._getModelLeafletObject(lid);
              layerObject.statusLoadLayer = true;
              load.push(layerObject);
            }
          });
        }

        leafletObject.statusLoadLayer = true;
        load.push(leafletObject);

        leafletMap.once('moveend', () => {
          later(() => {
            document.getElementsByClassName('leaflet-control-zoom leaflet-bar leaflet-control')[0].style.display = 'none';
            document.getElementsByClassName('history-control leaflet-bar leaflet-control horizontal')[0].style.display = 'none';
            $(document).find('.leaflet-top.leaflet-left').css('display', 'none');
            $(document).find('.leaflet-top.leaflet-right').css('display', 'none');
            $(document).find('.leaflet-bottom.leaflet-right').css('display', 'none');

            const promises = load.map((object) => !isNone(leafletObject.promiseLoadLayer) && (leafletObject.promiseLoadLayer instanceof Promise));

            allSettled(promises).then((e) => {
              load.forEach((obj) => {
                obj.statusLoadLayer = false;
                obj.promiseLoadLayer = null;
              });

              const html2canvasOptions = Object.assign({
                useCORS: true,
                onclone(clonedDoc) {
                  html2canvasClone(clonedDoc);
                },
              });
              window.html2canvas($mapPicture[0], html2canvasOptions)
                .then((canvas) => {
                  const type = 'image/png';
                  const image64 = canvas.toDataURL(type);
                  resolve(image64);
                })
                .catch((e) => reject(e))
                .finally(() => {
                  document.getElementsByClassName('leaflet-control-zoom leaflet-bar leaflet-control')[0].style.display = 'block';
                  document.getElementsByClassName('history-control leaflet-bar leaflet-control horizontal')[0].style.display = 'block';
                  $(document).find('.leaflet-top.leaflet-left').css('display', 'block');
                  $(document).find('.leaflet-top.leaflet-right').css('display', 'block');
                  $(document).find('.leaflet-bottom.leaflet-right').css('display', 'block');
                  $mapPicture.height(heightMap);
                  $mapPicture.width(widthMap);
                });
            });
          });
        });

        const bounds = featureLayer[0].getBounds();
        if (!isNone(bounds)) {
          leafletMap.fitBounds(bounds.pad(0.5));
        }
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    Download image for layer object.
    @method  downloadSnapShot
    @param {Object} source Object with settings
    {
      layerId, //{string} Layer ID.
      objectId, //{string} Object ID.
      layerArrIds, //{Array} Array of layers IDs.
      options {
        width, //{number} width image
        height //{number} height image
      },
      fileName //{string} File name.
    }
    @return {File} Image file.
  */
  downloadSnapShot({
    layerId, objectId, layerArrIds, options, fileName,
  }) {
    this.getSnapShot({
      layerId, objectId, layerArrIds, options,
    }).then((uri) => {
      const link = document.createElement('a');
      if (typeof link.download === 'string') {
        link.href = uri;
        link.download = fileName;

        // Firefox requires the link to be in the body
        document.body.appendChild(link);

        // simulate click
        link.click();

        // remove the link when done
        document.body.removeChild(link);
      } else {
        window.open(uri);
      }
    });
  },

  /**
    Get a rhumb object for [LineString, MultiLineString, Polygon, MultiPolygon]. Parameters is object in GeoJSON
    format and name of coordinate reference system. Calculates rhumb between points. Use jsts libraries to calculate distance between points.
    Distance calculation in units of coordinate reference system. Names of direction is [NE, SE, NW, SW]. Angle calculation in degree.
    Returns array of object:

    ```javascript
    [{
      type - type of object is [LineString, Polygon],
      crs - name of coordinate reference system of start point,
      startPoint - coordinates of start point,
      skip - how many rhumb skip from beginning (always 0),
      points - array objects of rhumbs,
      hole - if this part is hole then true else false. Only Polygon and MultiPolygon have it.
    }]
    ```

    Objects of rhumbs consist from angle, distance and direction of rhumb. Example:

    ```javascript
    {
      rhumb: 'NE',
      angle: 45,
      distance: 1000
    }
    ```

    Example of method call:

    ```javascript
    var feature = {
      type: "Feature",
      geometry:
      {
        "type": "Polygon",
        "coordinates": [
          [[56.09419, 58.08895], [56.093588, 58.088632], [56.094269, 58.088632], [56.094269, 58.088902], [56.09419, 58.08895]]
        ]
      }
    };

    var result = mapApi.mapModel.getRhumb(feature, 'EPSG:4326');
    ```
    @method  getRhumb
    @param {Object} feature GeoJson Feature.
    @param {string} crsName Name of coordinate reference system, in which to give coordinates.
    @return {Array} Array object rhumb.
  */
  getRhumb(feature, crsName) {
    const coords = feature.geometry.coordinates;
    const result = [];

    const calcRhumb = function (point1, point2) {
      // Get distance
      const geojson1 = {
        type: 'Point',
        coordinates: point1,
      };
      const geojson2 = {
        type: 'Point',
        coordinates: point2,
      };

      const jsts1 = geometryToJsts(geojson1);
      const jsts2 = geometryToJsts(geojson2);
      const distance = jsts1.distance(jsts2);

      // Get the angle.
      const getAngle = function (p1, p2) {
        return Math.atan2(p1[1] - p2[1], p1[0] - p2[0]) / Math.PI * 180;
      };

      const bearing = getAngle(point2, point1);

      let rhumb;
      let angle;

      // Calculates rhumb.
      if (bearing <= 90 && bearing >= 0) {
        // NE
        rhumb = 'NE';
        angle = 90 - bearing;
      } else if (bearing <= 180 && bearing >= 90) {
        // NW
        rhumb = 'NW';
        angle = (bearing - 90);
      } else if (bearing >= -180 && bearing <= -90) {
        // SW
        rhumb = 'SW';
        angle = (-1 * bearing - 90);
      }

      if (bearing <= 0 && bearing >= -90) {
        // SE
        rhumb = 'SE';
        angle = (90 + bearing);
      }

      return {
        rhumb,
        angle,
        distance,
      };
    };

    const coordToRhumbs = function (type, coords) {
      let startPoint = null;
      let n;
      let point1;
      let point2;
      const rhumbs = [];
      for (let i = 0; i < coords.length - 1; i++) {
        startPoint = i === 0 ? coords[i] : startPoint;
        point1 = coords[i];
        n = !isNone(coords[i + 1]) ? i + 1 : 0;
        point2 = coords[n];
        rhumbs.push(calcRhumb(point1, point2));
      }

      return {
        type,
        crs: crsName,
        startPoint,
        skip: 0,
        points: rhumbs,
      };
    };

    switch (feature.geometry.type) {
      case 'LineString':
        result.push(coordToRhumbs('LineString', coords));
        break;
      case 'MultiLineString':
        for (let i = 0; i < coords.length; i++) {
          result.push(coordToRhumbs('LineString', coords[i]));
        }

        break;
      case 'Polygon':
        for (let i = 0; i < coords.length; i++) {
          result.push(coordToRhumbs('Polygon', coords[i]));
          result[i].hole = i > 0;
        }

        break;
      case 'MultiPolygon':
        for (let i = 0; i < coords.length; i++) {
          for (let j = 0; j < coords[i].length; j++) {
            result.push(coordToRhumbs('Polygon', coords[i][j]));
            result[result.length - 1].hole = j > 0;
          }
        }

        break;
    }

    return result;
  },

  /**
    Add a layer to the group.

    @method layerToGroup
    @parm {string} layerId Layer ID.
    @parm {string} layerGroupId Group layer ID.
    @return nothing
  */
  moveLayerToGroup(layerId, layerGroupId) {
    const layer = this.get('mapLayer').findBy('id', layerGroupId);
    if (isNone(layer)) {
      throw (`Group layer '${layerGroupId}' not found`);
    }

    const layerModel = this.getLayerModel(layerId);
    if (isNone(layerModel)) {
      throw (`Layer '${layerId}' not found`);
    }

    layerModel.set('parent', layer);
  },

  /**
    Edit object layer.
    @method editLayerObject
    @param {String} layerId Layer ID.
    @param {String} objectId Object ID.
    @param {String} polygon Сoordinates of the new object in geoJSON format.
    @param {String} crsName Name of coordinate reference system.
    @return {Promise} Layer object.
  */
  editLayerObject(layerId, objectId, polygon, crsName) {
    return new Promise((resolve, reject) => {
      if (polygon) {
        this._getModelLayerFeature(layerId, [objectId], true).then(([, leafletLayer, featureLayer]) => {
          if (leafletLayer && featureLayer) {
            let { crs, } = leafletLayer.options;
            if (!isNone(crsName)) {
              crs = getLeafletCrs(`{ "code": "${crsName.toUpperCase()}", "definition": "" }`, this);
            }

            const coordsToLatLng = function (coords) {
              return crs.unproject(L.point(coords));
            };

            let geoJSON = null;
            if (!isNone(crs) && crs.code !== 'EPSG:4326') {
              geoJSON = L.geoJSON(polygon, { coordsToLatLng: coordsToLatLng.bind(this), }).getLayers()[0];
            } else {
              geoJSON = L.geoJSON(polygon).getLayers()[0];
            }

            if (!isNone(get(geoJSON, 'feature.geometry'))) {
              if (get(geoJSON, 'feature.geometry.type').toLowerCase() !== 'point') {
                featureLayer[0].setLatLngs(geoJSON._latlngs);
              } else {
                featureLayer[0].setLatLng(geoJSON._latlng);
              }

              if (typeof leafletLayer.editLayer === 'function') {
                leafletLayer.editLayer(featureLayer[0]);
                resolve(featureLayer[0]);
              }
            } else {
              reject(`Unable to convert coordinates for this CRS '${crsName}'`);
            }
          } else if (leafletLayer) {
            reject(`Layer '${layerId}' not found`);
          } else if (featureLayer[0]) {
            reject(`Object '${objectId}' not found`);
          }
        }).catch((e) => {
          reject(e);
        });
      } else {
        reject('new object settings not passed');
      }
    });
  },

  /**
    Upload file.
    @method uploadFile
    @param {File} file.
    @return {Promise} Object in geoJSON format
  */
  uploadFile(file) {
    const config = getOwner(this).resolveRegistration('config:environment');
    const data = new FormData();
    data.append(file.name, file);

    return new Promise((resolve, reject) => {
      $.ajax({
        url: `${config.APP.backendUrl}/controls/FileUploaderHandler.ashx?FileName=${file.name}`,
        type: 'POST',
        data,
        cache: false,
        contentType: false,
        processData: false,
        success(data) {
          resolve(data);
        },
        error(e) {
          reject(e);
        },
      });
    });
  },

  _isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
  },

  /**
    Convert coordinates of object to wgs84, or other crsName.
    @method convertObjectCoordinates
    @param {featureLayer} object.
    @return {featureLayer} Returns provided object with converted coordinates
    @private
  */
  _convertObjectCoordinates(projection, object, crsName = null) {
    // copy from https://stackoverflow.com/a/48218209/2014079 for replace $.extend
    // such as it is not properly work with Proxy properties
    var mergeDeep = function (...objects) {
      const isObject = (obj) => obj && typeof obj === 'object';

      return objects.reduce((prev, obj) => {
        Object.keys(obj).forEach((key) => {
          const pVal = prev[key];
          const oVal = obj[key];

          if (Array.isArray(pVal) && Array.isArray(oVal)) {
            prev[key] = pVal.concat(...oVal);
          } else if (isObject(pVal) && isObject(oVal)) {
            prev[key] = mergeDeep(pVal, oVal);
          } else {
            prev[key] = oVal;
          }
        });

        return prev;
      }, {});
    };

    const knownCrs = getOwner(this).knownForType('coordinate-reference-system');
    const knownCrsArray = A(Object.values(knownCrs));
    const firstProjection = projection || 'EPSG:4326';
    const secondProjection = crsName || 'EPSG:4326';
    const firstCrs = knownCrsArray.findBy('code', firstProjection);
    const secondCrs = knownCrsArray.findBy('code', secondProjection);
    if (firstCrs && secondCrs) {
      const firstDefinition = get(firstCrs, 'definition');
      const secondDefinition = get(secondCrs, 'definition');
      if (firstDefinition && secondDefinition) {
        if (firstDefinition !== secondDefinition) {
          const result = mergeDeep({}, object);
          let coordinatesArray = [];
          if (result.geometry.type !== 'Point') {
            result.geometry.coordinates.forEach((arr) => {
              const arr1 = [];
              if (result.geometry.type.indexOf('Multi') !== -1) {
                arr.forEach((pair) => {
                  if (result.geometry.type === 'MultiPolygon') {
                    const arr2 = [];
                    pair.forEach((cords) => {
                      const transdormedCords = proj4(firstDefinition, secondDefinition, cords);
                      arr2.push(transdormedCords);
                    });
                    arr1.push(arr2);
                  } else {
                    const cords = proj4(firstDefinition, secondDefinition, pair);
                    arr1.push(cords);
                  }
                });
                coordinatesArray.push(arr1);
              } else if (result.geometry.type === 'Polygon') {
                arr.forEach((cords) => {
                  const transdormedCords = proj4(firstDefinition, secondDefinition, cords);
                  arr1.push(transdormedCords);
                });
                coordinatesArray.push(arr1);
              } else {
                const cords = proj4(firstDefinition, secondDefinition, arr);
                coordinatesArray.push(cords);
              }
            });
          } else {
            coordinatesArray = proj4(firstDefinition, secondDefinition, result.geometry.coordinates);
          }

          result.geometry.coordinates = coordinatesArray;
          return result;
        }

        return object;
      }
    } else {
      throw 'unknown coordinate reference system';
    }
  },

  /*
    Get the field to search for objects
    @method getPkField
    @param {Object} layer.
    @return {String} Field name.
  */
  _getPkField(layer) {
    if (!isNone(layer) && !isNone(layer._leafletObject) && typeof layer._leafletObject.getPkField === 'function') {
      return layer._leafletObject.getPkField(layer);
    }

    throw 'Layer is not VectorLayer';
  },

  /**
    Get coordinates point.
    @method getCoordPoint
    @param {String} crsName Name of coordinate reference system, in which to give coordinates.
    @param {Boolean} snap Snap or not
    @param {Array} snapLayers Layers for snap
    @param {Integer} snapDistance in pixels
    @param {Boolean} snapOnlyVertex or segments too
    @return {Promise} Coordinate.
  */
  getCoordPoint(crsName, snap, snapLayers, snapDistance, snapOnlyVertex) {
    return new Promise((resolve, reject) => {
      const leafletMap = this.get('mapApi').getFromApi('leafletMap');
      $(leafletMap._container).css('cursor', 'crosshair');

      const getCoord = (e) => {
        if (snap) {
          this._drawClick(e);
        }

        leafletMap.off('mousemove', this._handleSnapping, this);
        const layers = this.get('_snapLayersGroups');
        if (layers) {
          layers.forEach((l, i) => {
            l.off('load', this._setSnappingFeatures, this);
          });
        }

        this._cleanupSnapping();

        $(leafletMap._container).css('cursor', '');
        let crs = get(leafletMap, 'options.crs');
        if (!isNone(crsName)) {
          crs = getLeafletCrs(`{ "code": "${crsName.toUpperCase()}", "definition": "" }`, this);
        }

        resolve(crs.project(e.latlng));
      };

      if (snap) {
        const layers = snapLayers.map((id) => {
          const [, leafletObject] = this._getModelLeafletObject(id);
          return leafletObject;
        }).filter((l) => !!l);

        layers.forEach((l, i) => {
          l.on('load', this._setSnappingFeatures, this);
        });

        this.set('_snapLayersGroups', layers);
        this._setSnappingFeatures();

        if (snapDistance) {
          this.set('_snapDistance', snapDistance);
        }

        if (!isNone(snapOnlyVertex)) {
          this.set('_snapOnlyVertex', snapOnlyVertex);
        }

        const editTools = this._getEditTools();
        leafletMap.on('mousemove', this._handleSnapping, this);
        this.set('_snapMarker', L.marker(leafletMap.getCenter(), {
          icon: editTools.createVertexIcon({ className: 'leaflet-div-icon leaflet-drawing-icon', }),
          opacity: 1,
          zIndexOffset: 1000,
        }));
      }

      leafletMap.once('click', getCoord);
    });
  },

  /**
    Loading features by packages
    @method loadingFeaturesByPackages
    @param {String} layerId Layer ID.
    @param {Array} objectIds Object IDs.
    @return {Promise}
  */
  loadingFeaturesByPackages(layerId, objectIds, shouldRemove = false) {
    const packageSize = 100;

    const layerPromises = [];

    let startPackage = 0;
    while (startPackage < objectIds.length) {
      const endPackage = (startPackage + packageSize) <= objectIds.length ? startPackage + packageSize : objectIds.length;
      const objectsPackage = [];
      for (let i = startPackage; i < endPackage; i++) {
        objectsPackage.push(objectIds[i]);
      }

      layerPromises.push(this._getModelLayerFeature(layerId, objectsPackage, shouldRemove));
      startPackage = endPackage;
    }

    return layerPromises;
  },

  /**
    Get merged geometry. Loads objects from a layers by packages of 100 units each.
    Waits when all objects successfully load. Transform objects into JSTS objects.
    First it merges geometry of objects on first layer using _getMulti method, then on second layer.
    Result of combining objects in each layer is merged into a common geometry using createMulti method.

    @method getMergedGeometry
    @param {String} layerAId First layer ID.
    @param {Array} objectAIds First layer object IDs.
    @param {String} layerBId Second layer ID.
    @param {Array} objectBIds Second layer object IDs.
    @param {Boolean} failIfInvalid Fail when has invalid geometry.
    @param {Boolean} forceMulti Flag: indicates whether to make geometries as multi..
    @return {Promise} GeoJson Feature.
  */
  getMergedGeometry(layerAId, objectAIds, layerBId, objectBIds, isUnion = false, failIfInvalid = false, forceMulti = true) {
    return new Promise((resolve, reject) => {
      const layerAPromises = this.loadingFeaturesByPackages(layerAId, objectAIds);
      const layerBPromises = this.loadingFeaturesByPackages(layerBId, objectBIds);

      allSettled(
        layerAPromises.concat(layerBPromises)
      ).then((layerFeatures) => {
        const rejected = layerFeatures.filter((item) => item.state === 'rejected').length > 0;

        if (rejected) {
          reject('Error loading objects');
        }

        let count = 0;
        const scale = this.get('mapApi').getFromApi('precisionScale');
        const resultObjs = A();

        layerFeatures.forEach((r, i) => {
          const geometries = A();
          r.value[2].forEach((obj, ind) => {
            if (get(obj, 'feature.geometry') && get(obj, 'options.crs.code')) {
              const feature = obj.toJsts(obj.options.crs, scale);
              geometries.pushObject(feature);
            }
          });

          count += 1;

          // если вся геометрия невалидна, то будет null
          const merged = this._getMulti(geometries, isUnion, failIfInvalid);
          if (merged) {
            resultObjs.pushObject(merged);
          }
        });

        const resultObj = resultObjs.length > 0 ? this.createMulti(resultObjs, isUnion, failIfInvalid, true, forceMulti) : null;
        resolve(resultObj || null);
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    Add to array points and feature.
    @method _addToArrayPointsAndFeature
    @param {String} layerId Layer ID.
    @param {String} crsName Name of coordinate reference system, in which to conver coordinates.
    @return {Promise} array of points and feature.
  */
  _addToArrayPointsAndFeature(layerId, crsName) {
    return new Promise((resolve, reject) => {
      this._getModelLayerFeature(layerId, null).then(([, layerObject, layerFeatures]) => {
        if (!isEmpty(layerFeatures)) {
          const arrPoints = A();
          const features = A();
          layerFeatures.forEach((layer) => {
            let obj = layer.feature;
            if (!isNone(crsName)) {
              obj = this._convertObjectCoordinates(layerObject.options.crs.code, obj, crsName);
            }

            const featureLayer = L.GeoJSON.geometryToLayer(obj);
            arrPoints.push(this._coordsToPoints(featureLayer.getLatLngs()));
            features.push(layer);
          });

          resolve({ arrPoints, features, });
        } else {
          reject('Error to load objects');
        }
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    Difference layers.
    @method differenceLayers
    @param {String} layerAId First layer ID.
    @param {String} layerBId Second layer ID.
    @return {Promise} array of Object { diffFeatures, layerAFeatures, layerBFeatures }.
  */
  differenceLayers(layerAId, layerBId) {
    return new Promise((resolve, reject) => {
      const crsA = this._getModelLeafletObject(layerAId)[1].options.crs.code;
      const crsB = this._getModelLeafletObject(layerBId)[1].options.crs.code;
      let arrayPointsAndFeaturePromises = [this._addToArrayPointsAndFeature(layerAId), this._addToArrayPointsAndFeature(layerBId)];
      if (crsA !== crsB) {
        arrayPointsAndFeaturePromises = [this._addToArrayPointsAndFeature(layerAId), this._addToArrayPointsAndFeature(layerBId, crsA)];
      }

      all(arrayPointsAndFeaturePromises).then((res) => {
        const subj = res[0].arrPoints; // layer A
        const clip = res[1].arrPoints; // layer B
        const solution = ClipperLib.Paths();
        const cpr = new ClipperLib.Clipper(); // The Clipper constructor creates an instance of the Clipper class

        // Add 'Subject' paths - layer A
        for (let s = 0, slen = subj.length; s < slen; s++) {
          if (isArray(subj[s])) { // multipolygon
            for (let k = 0, klen = subj[s].length; k < klen; k++) {
              cpr.AddPaths(subj[s][k], ClipperLib.PolyType.ptSubject, true);
            }
          } else { // polygon
            cpr.AddPaths(subj[s], ClipperLib.PolyType.ptSubject, true);
          }
        }

        // Add 'Clipping' paths - layer B
        for (let c = 0, clen = clip.length; c < clen; c++) {
          if (isArray(clip[c])) { // multipolygon
            for (let k = 0, klen = clip[c].length; k < klen; k++) {
              cpr.AddPaths(clip[c][k], ClipperLib.PolyType.ptClip, true);
            }
          } else { // polygon
            cpr.AddPaths(clip[c], ClipperLib.PolyType.ptClip, true);
          }
        }

        // Performing the clipping operation - Difference, result operation be return in solution
        cpr.Execute(ClipperLib.ClipType.ctDifference, solution);

        // filtering 'solution' by area !== 0, transformating of geometry in jsts for comparison and calculate area, filtering after transformation by area > 0
        if (!isEmpty(solution)) {
          const jstsGeoJSONReader = new jsts.io.GeoJSONReader();
          const diffNotNullArea = solution.filter((geom) => ClipperLib.Clipper.Area(geom) !== 0).map((geom) => {
            const feature = {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [this._pointsToCoords(geom)],
              },
            };
            const jstsFeature = jstsGeoJSONReader.read(feature);
            if (jstsFeature.geometry.isValid()) {
              const area = jstsFeature.geometry.getArea();
              return { feature, jstsGeometry: jstsFeature.geometry, area, };
            }

            return { feature, jstsGeometry: jstsFeature.geometry, area: 0, };
          }).filter((diff) => diff.area > 0);

          resolve({ diffFeatures: diffNotNullArea, layerA: res[0].features, layerB: res[1].features, });
        } else {
          resolve('The difference is not found');
        }
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    Compare layers.
    @method compareLayers
    @param {String} layerAId First layer ID.
    @param {String} layerBId Second layer ID.
    @param {String} condition Comparison conditions ["contains", "intersects", "notIntersects"].
    @param {Boolean} showOnMap flag indicates if difference area will be displayed on map.
    @return {Promise} array of objects with {areaDifference, objectDifference, id of layerB, that matches the condition}.
  */
  compareLayers(layerAId, layerBId, condition, showOnMap) {
    return new Promise((resolve, reject) => {
      const result = A();
      const cond = ['contains', 'intersects', 'notIntersects'];
      let diffLayerPromise = this.differenceLayers(layerAId, layerBId);
      if (!cond.includes(condition)) {
        reject('The comparison condition is set incorrectly. It must be ["contains", "intersects", "notIntersects"].');
      } else if (condition === cond[2]) {
        diffLayerPromise = this.differenceLayers(layerBId, layerAId);
      }

      diffLayerPromise.then((res) => {
        if (res.hasOwnProperty('diffFeatures')) {
          const jstsGeoJSONReader = new jsts.io.GeoJSONReader();
          res.diffFeatures.forEach((diff) => {
            if (!cond.includes(condition)) {
              reject('The comparison condition is set incorrectly. It must be ["contains", "intersects", "notIntersects"].');
            }

            let layerFeatures = res.layerB;
            if (condition === cond[2]) {
              layerFeatures = res.layerA;
            }

            const { crs, } = res.layerA[0].options;
            const coordsToLatLng = function (coords) {
              return crs.unproject(L.point(coords));
            };

            const featureLayer = L.geoJSON(diff.feature, { coordsToLatLng: coordsToLatLng.bind(this), }).getLayers()[0];
            const object = {
              areaDifference: diff.area,
              objectDifference: featureLayer,
            };

            layerFeatures.every((feat) => {
              const jstsFeat = jstsGeoJSONReader.read(feat.feature);
              if (jstsFeat.geometry.isValid()) {
                switch (condition) {
                  case cond[0]:
                    if (jstsFeat.geometry.contains(diff.jstsGeometry)) {
                      object.id = jstsFeat.properties.primarykey;
                      return false;
                    }

                    return true;


                    break;
                  case cond[1]:
                    if (jstsFeat.geometry.intersects(diff.jstsGeometry) && !jstsFeat.geometry.contains(diff.jstsGeometry)) {
                      object.id = jstsFeat.properties.primarykey;
                      return false;
                    }

                    return true;


                    break;
                  case cond[2]:
                    if (jstsFeat.geometry.intersects(diff.jstsGeometry)) {
                      object.id = jstsFeat.properties.primarykey;
                      return false;
                    }

                    return true;


                    break;
                  default:
                    return true;
                }
              } else {
                return true;
              }
            });

            if (showOnMap) {
              const serviceLayer = this.get('mapApi').getFromApi('serviceLayer');
              featureLayer.addTo(serviceLayer);
            }

            result.pushObject(object);
          });
          resolve(result);
        } else {
          reject(res);
        }
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    Exponentiation.
    @method _pointAmplifier
    @return {Number} 100000000.
  */
  _pointAmplifier() {
    return Math.pow(10, 8);
  },

  /**
    Transform coordinates in points.
    @method _coordsToPoints
    @param {Array} polygons Array of coordinates.
    @return {Array} Array of points.
  */
  _coordsToPoints(polygons) {
    const amp = this._pointAmplifier();
    if (Array.isArray(polygons[0]) || (!(polygons instanceof L.LatLng) && (polygons[0] instanceof L.LatLng))) {
      const coords = [];
      for (let i = 0; i < polygons.length; i++) {
        coords.push(this._coordsToPoints(polygons[i]));
      }

      return coords;
    }

    return { X: Math.round(polygons.lng * amp), Y: Math.round(polygons.lat * amp), };
  },

  /**
    Transform points in coordinates.
    @method _pointsToCoords
    @param {Array} points Array of points.
    @return {Array} Array of coordinates.
  */
  _pointsToCoords(points) {
    const amp = this._pointAmplifier();
    if (Array.isArray(points[0]) || (!(points instanceof ClipperLib.IntPoint) && (points[0] instanceof ClipperLib.IntPoint))) {
      const coord = [];
      for (let i = 0; i < points.length; i++) {
        coord.push(this._pointsToCoords(points[i]));
      }

      // closing polygon
      if (!Array.isArray(coord[0][0])) {
        const first = coord[0];
        coord.push(first);
      }

      return coord;
    }

    return [points.X / amp, points.Y / amp];
  },

  _requestDownloadFile(layerModel, objectIds, outputFormat, crsOuput, crsLayer, url) {
    return new Promise((resolve, reject) => {
      downloadFile(layerModel, objectIds, outputFormat, crsOuput, crsLayer, url).then((res) => {
        resolve(res);
      }).catch((e) => {
        reject(e);
      });
    });
  },

  /**
    Download file.
    @method downloadFile
    @param {String} layerId.
    @param {Array} objectIds.
    @param {String} outputFormat.
    @param {String} crsName.
    @param {boolean} isFile flag indicates if return file or blob. By default 'true'.
    @return {Promise} Object consist of fileName and blob. If isFile = true then returns file too.
  */
  downloadFile(layerId, objectIds, outputFormat, crsName, isFile = true) {
    const config = getOwner(this).resolveRegistration('config:environment');
    const url = config.APP.backendUrls.featureExportApi;

    return new Promise((resolve, reject) => {
      const layerModel = this.get('mapLayer').findBy('id', layerId);
      if (isNone(layerModel)) {
        reject(`Layer '${layerId}' not found.`);
      }

      const crsOuput = getCrsByName(crsName, this);
      const crsLayer = getCrsByName(layerModel.get('crs').code, this);
      this._requestDownloadFile(layerModel, objectIds, outputFormat, crsOuput, crsLayer, url).then((res) => {
        if (isFile) {
          downloadBlob(res.fileName, res.blob);
        }

        resolve(res);
      }).catch((e) => {
        reject(e);
      });
    });
  },

  setLayerFilter(layerId, filter) {
    const layerModel = this.getLayerModel(layerId);

    if (isNone(layerModel)) {
      return;
    }

    layerModel.set('filter', filter);
  },
});
