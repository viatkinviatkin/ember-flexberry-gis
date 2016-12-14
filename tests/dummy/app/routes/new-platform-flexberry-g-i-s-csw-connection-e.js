/**
  @module ember-flexberry-gis-dummy
*/

import EditFormRoute from 'ember-flexberry/routes/edit-form';
import EditFormRouteOperationsIndicationMixin from '../mixins/edit-form-route-operations-indication';

/**
  CSW connection edit route.

  @class NewPlatformFlexberryGISCswConnectionERoute
  @extends EditFormRoute
  @uses EditFormRouteOperationsIndicationMixin
*/
export default EditFormRoute.extend(EditFormRouteOperationsIndicationMixin, {
  /**
    Name of model projection to be used as record's properties limitation.

    @property modelProjection
    @type String
    @default 'CswConnectionE'
  */
  modelProjection: 'CswConnectionE',

  /**
    Name of model to be used as record type.

    @property modelName
    @type String
    @default 'new-platform-flexberry-g-i-s-csw-connection'
  */
  modelName: 'new-platform-flexberry-g-i-s-csw-connection'
});
