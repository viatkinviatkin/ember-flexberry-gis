import { isEmpty, isNone } from '@ember/utils';
import { observer, get, computed } from '@ember/object';
import { A } from '@ember/array';
import Component from '@ember/component';
import layout from '../templates/components/flexberry-multiple-select';

/**
  Flexberry multiple select component.
  Usage example:

  templates/my-form.hbs

  ```handlebars
  {{flexberry-multiple-select
    items=fields
    selectedItems=value.searchFields
    title=('t' _searchFieldsSelectorLabel)
    allowAdditions=true
  }}
  ```
  @class FlexberryMultipleSelectComponent
  @extends <a href="http://emberjs.com/api/classes/Ember.Component.html">Ember.Component</a>
*/
export default Component.extend({
  /**
    Reference to component's template.
  */
  layout,

  /**
    Array with all dropdown items.

    @property items
    @type Object
    @default Ember.A()
  */
  items: A(),

  /**
    Flag, indicate that selection was remove.

    @property isRemove
    @type Boolean
    @default false
  */
  isRemove: false,

  /**
    Array with selected dropdown items.

    @property selectedItems
    @type Object
    @default Ember.A()
  */
  selectedItems: A(),

  /**
    Array with selected dropdown items.

    @property selectedLabels
    @type Object
    @default Ember.A()
  */
  selectedLabels: A(),

  selectedItemsObserver: observer('selectedItems', function () {
    this.$('.fb-selector>input').val('');
    const selectedItems = this.get('selectedItems');
    if (selectedItems) {
      const { length, } = selectedItems;
      const lastVal = selectedItems[length - 1];
      if (length > 1) {
        this.$('.fb-selector>a').remove();
        this.$('.fb-selector').append(`<a class="ui label transition visible adition">и ещё ${length - 1}</a>`);
      }

      if (this.get('isRemove')) {
        this.set('isRemove', false);
        const items = this.get('items');
        const val = items.filter((item) => {
          if (this.get('isObject')) {
            return item.id === lastVal;
          }

          return item === lastVal;
        });

        this.$('.fb-selector>input.search').before(`<a class="ui label transition visible" data-value="${lastVal}" style="display: inline-block !important;">`
          + `${this.get('isObject') ? get(val[0], 'name') : val[0]}<i class="delete icon"></i></a>`);
        if (length > 1) {
          this.$('.fb-selector>a.adition').remove();
          this.$('.fb-selector').append(`<a class="ui label transition visible adition">и ещё ${length - 1}</a>`);
        } else {
          this.$('.fb-selector>a.adition').remove();
        }
      }
    }
  }),

  /**
    Dropdown title.

    @property title
    @type String
    @default undefined
  */
  title: undefined,

  /**
    Flag, allows or forbids manual addition.

    @property allowAdditions
    @type Boolean
    @default false
  */
  allowAdditions: false,

  /**
    Classname.

    @property selectorName
    @type String
    @default 'fb-selector'
  */
  selectorName: 'fb-selector',

  /**
    Flag indicates whether is array consists of objects or not.

    @property isObject
    @type Bool
    @default 'false'
  */
  isObject: false,

  /**
    Array with not-selected dropdown items.

    @property _usedItems
    @type Object
    @readonly
  */
  _usedItems: computed('items', 'selectedItems', function () {
    const items = this.get('items');
    const selectedItems = this.get('selectedItems');
    if (isEmpty(items) || isEmpty(selectedItems)) {
      return items;
    }

    const ret = A();
    items.forEach((item, i, items) => {
      if (selectedItems.indexOf(item) === -1) {
        ret.push(item);
      }
    });
    return ret;
  }),

  /**
    Hook, working after element insertion
  */
  didInsertElement() {
    const selName = this.get('selectorName');
    const allowAdditions = this.get('allowAdditions');
    let addResultCaption = '';

    if (this.get('i18n.locale') === 'ru') {
      addResultCaption = 'Добавить <b>{term}</b>';
    } else {
      addResultCaption = 'Add <b>{term}</b>';
    }

    this.$(`.${selName}`)
      .dropdown({
        message: {
          addResult: addResultCaption,
        },
        allowAdditions,
        onChange: (value) => {
          let itemArray = value.split(',');
          if (value === '') {
            itemArray = null;
          }

          const selectedItems = this.get('selectedItems');
          if (!isNone(selectedItems) && (isNone(itemArray) || selectedItems.length > itemArray.length)) {
            this.set('isRemove', true);
          }

          this.set('selectedItems', itemArray);
        },
      });
  },

  actions: {
    clear() {
      this.set('selectedItems', A());
      this.$('.fb-selector>a').remove();
      this.$('.fb-selector>.menu>.item').attr('class', 'item');
    },
  },
});
