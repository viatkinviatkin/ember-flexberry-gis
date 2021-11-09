import { isNone } from '@ember/utils';
import EmberObject, { observer, get } from '@ember/object';
import { A } from '@ember/array';
import $ from 'jquery';
import FlexberryDropdown from 'ember-flexberry/components/flexberry-dropdown';
import { translationMacro as t } from 'ember-i18n';
import layout from '../templates/components/select-with-checkbox';

export default FlexberryDropdown.extend({
  /**
    Reference to component's template.
  */
  layout,

  selectAllText: t('components.flexberry-layers-intersections-panel.selectAllText'),

  /**
    Search for occurrences in the entire text (SemanticUI settings).
  */
  fullTextSearch: true,

  isAllSelected: false,

  isClearAllVisible: true,

  isSearchVisible: true,

  isSelectAllVisible: true,

  noResults: t('components.flexberry-layers-intersections-panel.notResult'),

  message: { noResults: '', },

  /**
   * Storage for the items state.
   * @example
   * ```javascript
   * [
   *   {
   *     key: '2e46cce0-b9fa-4b34-b417-4bd600a89c5d',
   *     value: 'Подтверждена',
   *     isVisible: false
   *   },
   *   ...
   * ]
   * ```
   */
  state: null,

  /**
    Flag indicates whether is array consists of objects or not.

    @property isObject
    @type Bool
    @default 'false'
  */
  isObject: false,

  /**
    Array with selected dropdown items.

    @property selectedItems
    @type Object
    @default Ember.A()
  */
  selectedItems: A(),

  /**
    Count selected items.

    @property countChoose
    @type Number
    @default 0
  */
  countChoose: 0,

  /**
    Classname.

    @property selectorName
    @type String
    @default 'fb-selector'
  */
  class: 'fb-selector',

  /**
    See [EmberJS API](https://emberjs.com/api/).
    @property classNames
  */
  classNames: ['multi-dropdown', 'fb-selector'],

  init() {
    this._super(...arguments);
    this.set('state', new A());
    const noRes = this.get('noResults').toString();
    this.set('message', { noResults: noRes, });

    const state = Object.entries(this.get('items'))
    .filter(([key, value]) => !isNone(value))
    .map(([i, val]) => {
      let value = val;
      let key = i;
      if (this.get('isObject')) {
        value = get(val, 'name');
        key = val.id;
      }

      return EmberObject.create({ key, value, isVisible: false });
    });

    this.get('state').addObjects(state);
  },

  stateObserver: observer('state.@each.isVisible', function () {
    const filteredState = this.get('state').filterBy('isVisible');
    const value = filteredState.map((item)=>item.key);
    // TODO: fix
    this.set('selectedItems', value);
    this.set('countChoose', value.length);
  }),

  actions: {
    selectAll() {
      const state = this.get('state');

      if (this.get('isAllSelected')) {
        this.send('clearAll');
      } else {
        state.setEach('isVisible', true);
      }

      this.toggleProperty('isAllSelected');
    },

    clearAll() {
      this.get('state').setEach('isVisible', false);
      $('.search-field').val('');
      $('.fb-selector .item.filtered').each((i, item) => {
        $(item).removeClass('filtered');
      });
    },

    onHide() {
      const $list = $('.fb-selector .menu');
      if ($list.hasClass('visible')) {
        $list.removeClass('visible');
        $list.addClass('hidden');
      } else {
        $list.removeClass('hidden');
        $list.addClass('visible');
      }
    },
  },
});
