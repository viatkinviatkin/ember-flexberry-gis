/**
  @module ember-flexberry-gis
*/

import { isNone } from '@ember/utils';
import MeasureMapTool from './measure';

/**
  Measure clear map-tool.

  @class MeasureClearMapTool
  @extends MeasureMapTool
*/
export default MeasureMapTool.extend({
  /**
    Enables tool.

    @method _enable
    @private
  */
  _enable() {
    this._super(...arguments);

    let _measureTools = this.get('_measureTools');
    if (!isNone(_measureTools)) {
      _measureTools.clearLayers();
    }

    this.disable();
  }
});
