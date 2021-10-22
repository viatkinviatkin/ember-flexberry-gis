/**
  @module ember-flexberry-gis
*/

import RectangleMaptool from './rectangle';

/**
  Zoom out map-tool.

  @class ZoomOutMaptool
  @extends RectangleMaptool
*/
export default RectangleMaptool.extend({
  /**
    Tool's cursor CSS-class.

    @property cursor
    @type String
    @default 'zoom-out'
  */
  cursor: 'zoom-out',

  /**
    Handles map's 'editable:drawing:end' event.

    @method _rectangleDrawingDidEnd
    @param {Object} e Event object.
    @param {<a href="http://leafletjs.com/reference-1.0.0.html#rectangle">L.Rectangle</a>} e.layer Drawn rectangle layer.
    @private
  */
  _rectangleDrawingDidEnd({ layer, }) {
    this._super(...arguments);

    const leafletMap = this.get('leafletMap');
    const mapSize = leafletMap.getBounds();
    const zoomSize = layer.getBounds();

    if (zoomSize.getNorthEast().equals(zoomSize.getSouthWest())) {
      const zoom = Math.max(leafletMap.getZoom() - 1, leafletMap.getMinZoom());
      leafletMap.setView(zoomSize.getNorthEast(), zoom);
    } else {
      const dx = (mapSize.getEast() - mapSize.getWest()) / (zoomSize.getEast() - zoomSize.getWest());
      const dy = (mapSize.getNorth() - mapSize.getSouth()) / (zoomSize.getNorth() - zoomSize.getSouth());
      const maxD = dx > dy ? dx : dy;

      const zoom = leafletMap.getScaleZoom(1 / maxD, leafletMap.getZoom());
      leafletMap.panTo(zoomSize.getCenter());
      leafletMap.setZoom(Math.floor(zoom));
    }
  },
});
