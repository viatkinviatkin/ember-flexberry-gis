import EmberObject from '@ember/object';
import FlexberryMapModelApiVisualeditMixin from 'ember-flexberry-gis/mixins/flexberry-map-model-api-visualedit';
import { module, test } from 'qunit';

module('Unit | Mixin | flexberry map model api visualedit', function () {
  // Replace this with your real tests.
  test('it works', function (assert) {
    const FlexberryMapModelApiVisualeditObject = EmberObject.extend(FlexberryMapModelApiVisualeditMixin);
    const subject = FlexberryMapModelApiVisualeditObject.create();
    assert.ok(subject);
  });

  test('one', function (assert) {
    assert.ok(true);
  });
});
