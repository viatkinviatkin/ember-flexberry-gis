import { checkMapZoom } from '../utils/check-zoom';

export default L.Canvas.extend({
  _updatePoly(layer, closed) {
    if (checkMapZoom(layer)) {
      L.Canvas.prototype._updatePoly.call(this, layer, closed);
    }
  },

  _updateCircle(layer) {
    if (checkMapZoom(layer)) {
      L.Canvas.prototype._updateCircle.call(this, layer);
    }
  },
});
