/**
  @module ember-flexberry-gis
*/

import { A } from '@ember/array';

import { getOwner } from '@ember/application';
import { isBlank, isNone } from '@ember/utils';
import { getGradientColors } from 'ember-flexberry-gis/utils/color-interpolation';
import layout from '../../templates/components/layers-styles/graduated';
import BaseCustomStyle from './categorized/base-categorized-layer-style';

/**
  Component containing GUI for 'graduated' layers-style

  @class GraduatedLayersStyleComponent
  @extends <a href="http://emberjs.com/api/classes/Ember.Component.html">Ember.Component</a>
*/
export default BaseCustomStyle.extend({
  /**
    Count of categories to which layer's features must be classified.

    @property _classificationCategoriesCount
    @type Number
    @default 1
    @private
  */
  _classificationCategoriesCount: 1,

  /**
    Reference to component's template.
  */
  layout,

  /**
    Component's wrapping <div> CSS-classes names.

    @property classNames
    @type String[]
    @default ['graduated-layers-style']
  */
  classNames: ['graduated-layers-style'],

  actions: {
    /**
      Handles 'classify' button click event.

      @method actions.onClassifyButtonClick
      @param {Object} e Event object.
    */
    onClassifyButtonClick() {
      const layerType = this.get('layerType');
      const leafletLayer = this.get('leafletLayer');
      if (isBlank(layerType) || isNone(leafletLayer)) {
        return;
      }

      const layerClass = getOwner(this).lookup(`layer:${layerType}`);
      const propertyName = this.get('styleSettings.style.propertyName');

      // Get distinct array of asc. sorted values.
      const propertyValues = [...new Set(layerClass.getLayerPropertyValues(leafletLayer, propertyName))].sort((a, b) => a - b);
      let categoriesCount = Number(this.get('_classificationCategoriesCount'));
      categoriesCount = isNaN(categoriesCount) ? 1 : categoriesCount;
      categoriesCount = categoriesCount <= 0 ? 1 : categoriesCount;
      categoriesCount = categoriesCount > propertyValues.length ? propertyValues.length : categoriesCount;
      const categories = A();
      const categoriesLength = (propertyValues.length - propertyValues.length % categoriesCount) / categoriesCount;
      const layersStylesRenderer = this.get('_layersStylesRenderer');
      const mainStyleSettings = layersStylesRenderer.getDefaultStyleSettings('simple');
      const { path, } = mainStyleSettings.style;

      let fillGradientColors = A();
      if (this.get('_fillGradientEnable')) {
        fillGradientColors = getGradientColors(this.get('_fillGradientColorStart'), this.get('_fillGradientColorEnd'), categoriesCount);
        path.fillGradientEnable = true;
      } else {
        path.fillGradientEnable = false;
      }

      let strokeGradientColors = A();
      if (this.get('_strokeGradientEnable')) {
        strokeGradientColors = getGradientColors(this.get('_strokeGradientColorStart'), this.get('_strokeGradientColorEnd'), categoriesCount);
        path.strokeGradientEnable = true;
      } else {
        path.strokeGradientEnable = false;
      }

      for (let i = 0; i < categoriesCount; i++) {
        const intervalStartIndex = i * categoriesLength;
        const intervalLastIndex = i === (categoriesCount - 1) ? propertyValues.length - 1 : (i + 1) * categoriesLength - 1;
        const catStyleSettings = layersStylesRenderer.getDefaultStyleSettings('simple');
        catStyleSettings.style.path.fillColor = (fillGradientColors[i] != null) ? fillGradientColors[i] : catStyleSettings.style.path.fillColor;
        catStyleSettings.style.path.color = (strokeGradientColors[i] != null) ? strokeGradientColors[i] : catStyleSettings.style.path.color;
        categories.push({
          name: i,
          value: `${propertyValues[intervalStartIndex]} - ${propertyValues[intervalLastIndex]}`,
          styleSettings: catStyleSettings,
        });
      }

      this.set('styleSettings.style.path', path);
      this.set('styleSettings.style.categories', categories);
      this.set('_selectedCategories', {});
      this.set('_selectedCategoriesCount', 0);
      this.set('_allCategoriesAreSelected', false);
      this.set('_classificationCategoriesCount', categoriesCount);
    },
  },
});
