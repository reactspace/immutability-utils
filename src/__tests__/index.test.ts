import { expect } from 'chai'; // tslint:disable-line:no-implicit-dependencies
import { concat, flatMap, merge, mergeDeep, replace, setIn, spliceIn, unshift, updateIn, without } from '../index';

describe('Testing immutability helper', () => {
  describe('::setIn', () => {
    it('works on one level', () => {
      const object = { a: 'a1' };
      const newObject = setIn(object, ['a'], 'new a1');

      const expectedObject = { a: 'new a1' };

      expect(object).not.to.eql(newObject);
      expect(newObject).not.to.equal(object);
      expect(newObject).to.eql(expectedObject);
    });

    it("updates references up the tree and leaves rest untouched and doesn't mutate original object", () => {
      const state = { a1: { a11: 'a11', a12: 'a12' }, b1: { b11: 'b11', b12: { b121: 'b121', b122: { b1221: 'b1221' } } } };
      const newState = setIn(state, ['b1', 'b12', 'b121'], 'new b121');

      expect(newState.b1).to.not.equal(state.b1);

      expect(newState.a1).to.equal(state.a1);
      expect(newState.b1.b12.b122).to.equal(state.b1.b12.b122);
      expect(newState).to.eql({
        a1: { a11: 'a11', a12: 'a12' },
        b1: { b11: 'b11', b12: { b121: 'new b121', b122: { b1221: 'b1221' } } }
      });
    });

    it('keeps reference equality when possible', () => {
      const state = { a: 1 };
      expect(setIn(state, 'a', 1)).to.equal(state);
      expect(setIn(state, 'a', 2)).not.to.equal(state);
    });

    it('setting a property to undefined should add an enumerable key to final object with value undefined', () => {
      const state = { a: 1 };
      const newState = setIn(state, 'b', undefined);

      expect(newState).not.to.equal(state);
      expect(newState).to.eql({ a: 1, b: undefined }, '');
      expect(Object.keys(newState).length).to.eql(2);
    });

    it('works on arrays', () => {
      const state = { a: [1, 2, 3, 4, 5] };
      const newState = setIn(state, ['a', 1], 21);

      expect(newState).to.eql({ a: [1, 21, 3, 4, 5] });
      expect(newState).not.to.equal(state);
      expect(newState).not.to.eql(state);
      expect(newState.a).not.to.equal(state.a);
    });
  });

  describe('::concat', () => {
    it('Adding two arrays', () => {
      const object = { a: [1, 2, 3, 4], b: [4, 5, 6, 8, 9] };
      const newObject = concat(object, 'a', [5, 6, 7]);

      expect(newObject).not.to.equal(object);
      expect(newObject).to.eql({ a: [1, 2, 3, 4, 5, 6, 7], b: [4, 5, 6, 8, 9] });
      expect(newObject.b).to.equal(object.b);
    });

    it('throws when the object at path is not an array', () => {
      const object = { a: [1, 2, 3, 4], b: { b1: 'this is a object' } };
      expect(() => {
        concat(object, 'b', [1, 2, 3]);
      }).to.throw();
    });
  });

  describe('::unshift', () => {
    it('Adding two arrays', () => {
      const object = { a: [1, 2, 3, 4], b: [4, 5, 6, 8, 9] };
      const newObject = unshift(object, 'a', [5, 6, 7]);

      expect(newObject).not.to.equal(object);
      expect(newObject).to.eql({ a: [5, 6, 7, 1, 2, 3, 4], b: [4, 5, 6, 8, 9] });
      expect(newObject.b).to.equal(object.b);
    });

    it('throws when the object at path is not an array', () => {
      const object = { a: [1, 2, 3, 4], b: { b1: 'this is a object' } };
      expect(() => {
        unshift(object, 'b', [1, 2, 3]);
      }).to.throw();
    });
  });

  describe('::updateIn', () => {
    it('Update the array', () => {
      const object = { a: [3, 2, 1, 7, 8] };
      const newObject = updateIn(object, ['a', 2], (value: number) => value + 1);

      expect(newObject).not.to.equal(object);
      expect(newObject).to.eql({ a: [3, 2, 2, 7, 8] });
    });
  });

  describe('::spliceIn', () => {
    it('splices a list only removing elements', () => {
      const object = { a: [1, 2, 3, 4] };
      const newObject = spliceIn(object, 'a', 1, 2);

      expect(newObject).to.eql({ a: [1, 4] });
    });

    it('doesnot flatten added items', () => {
      const object = { a: [1, 2, 3, 4] };
      const newObject = spliceIn(object, 'a', 0, 0, [[0.1], 0.2], 0.3, 0.4);

      expect(newObject).to.eql({ a: [[[0.1], 0.2], 0.3, 0.4, 1, 2, 3, 4] });
      expect(newObject).not.to.equal(object);
    });

    it('removing more elements then given in array', () => {
      const object = { a: [2, 4, 5, 6] };
      const newObject = spliceIn(object, 'a', 1, 6, [22, 33], 55, 66);

      expect(newObject).to.eql({ a: [2, [22, 33], 55, 66] });
      expect(newObject).not.to.equal(object);
    });

    it('removing elements when array is negative', () => {
      const object = { a: [1, 2, 3, 4] };
      const newObject = spliceIn(object, 'a', 5, -3, [6, 8, 7, 5]);

      expect(newObject).to.eql({ a: [1, 2, 3, 4, [6, 8, 7, 5]] });
      expect(newObject).not.to.equal(object);
    });

    it("updates references up the tree and leaves rest untouched and doesn't mutate original object", () => {
      const object = { b: [1, 2, 3, 4, 5] };
      const newObject = spliceIn(object, 'b', 2, 2, [7, 8, 9]);

      expect(object).to.eql({ b: [1, 2, 3, 4, 5] });
      expect(newObject.b).not.to.equal(object.b);
      expect(newObject).to.eql({ b: [1, 2, [7, 8, 9], 5] });
    });
  });

  describe('::without', () => {
    it('checking wether the array is correct or not', () => {
      const object = { a: '1', b: '2', c: '3', d: '4', e: '5', f: { f1: 'f1' } };
      const newObject = without(object, 'a', 'c', 'e');

      expect(newObject).to.eql({ b: '2', d: '4', f: { f1: 'f1' } });
      expect(object.a).not.to.equal(newObject.a);
      expect(object.f).to.equal(newObject.f);
    });

    it('Removing the values from array', () => {
      const object = { a: [1, 2, 3, 4], b: [6, 7, 8], c: { c1: '9', c2: '11', c3: '33' } };
      const newObject = without(object, 'b', 'c1');
      expect(newObject).to.eql({ a: [1, 2, 3, 4], c: { c1: '9', c2: '11', c3: '33' } });
      expect(object).not.to.equal(newObject);
    });

    it('function predicate works.', () => {
      const object = { a: 1, b: 2, c: 3, d: 4, e: 5 };
      const newObject = without(object, (value) => value % 2 === 0);
      expect(newObject).to.eql({ a: 1, c: 3, e: 5 });
    });
  });

  describe('::flatMap', () => {
    it('first maps, then shallow flattens', () => {
      const numbers = [97, 98, 99, 100];
      const letters = flatMap(numbers, (v) => [String.fromCharCode(v), String.fromCharCode(v).toUpperCase()]);
      expect(letters).to.eql(['a', 'A', 'b', 'B', 'c', 'C', 'd', 'D']);
    });

    it('flattens only 1 level', () => {
      const array = ['drop', 3, 3, 2, null, undefined];
      const result = flatMap(array, (value) => {
        if (typeof value === 'number') {
          return [[value]];
        }
        if (value == null) {
          return [value];
        }

        return value;
      });

      expect(result).to.eql(['drop', [3], [3], [2], null, undefined], '');
    });

    it('crashes when not a array', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        flatMap({}, (value) => value);
      }).to.throw('flatMap can only be applied on arrays');
    });
  });

  describe('::merge', () => {
    describe('shallow merge', () => {
      it('merges two objects', () => {
        expect(merge({ a: 'b' }, { a: 'c' })).to.eql({ a: 'c' });
        expect(merge({ a: 'b' }, { b: 'c' })).to.eql({ a: 'b', b: 'c' });
        expect(merge({ a: 'b', b: { b1: 'b1' } }, { b: 'c' })).to.eql({ a: 'b', b: 'c' });
        expect(merge({ a: [1, 2, 3] }, { a: [2, 3, 4] })).to.eql({ a: [2, 3, 4] });
        expect(merge({ a: [1, 2, 3] }, { a: { a1: 'a1' } })).to.eql({ a: { a1: 'a1' } });
        expect(merge({ a: [0, 1, 2] }, { b: [4, 5, 6] })).to.eql({ a: [0, 1, 2], b: [4, 5, 6] });
      });
    });

    describe('deep merge', () => {
      it('merges two objects works', () => {
        const obj1 = {
          a1: { a11: 'a11', a12: 'a12' },
          b1: { b11: 'b11', b12: { b121: 'b121', b122: { b1221: 'b1221' } } }
        };

        const obj2 = { b1: { b12: { b121: 'new b121' } } };

        const finalObject = mergeDeep(obj1, obj2);

        expect(finalObject).to.eql({
          a1: { a11: 'a11', a12: 'a12' },
          b1: { b11: 'b11', b12: { b121: 'new b121', b122: { b1221: 'b1221' } } }
        });

        expect(finalObject.a1).to.equal(obj1.a1);
      });

      it('merges two arrays works', () => {
        const obj1 = {
          a1: { a11: 'a11', a12: 'a12' },
          b1: { b11: 'b11', b12: { b121: 'b121', b122: ['a', 'b'] } }
        };

        const obj2 = {
          b1: { b11: 'b11', b12: { b121: 'new b121', b122: { b122: 'b122' } } }
        };

        const expectedObject = {
          a1: { a11: 'a11', a12: 'a12' },
          b1: {
            b11: 'b11',
            b12: { b121: 'new b121', b122: { b122: 'b122' } }
          }
        };

        const finalObject = mergeDeep(obj1, obj2);

        expect(finalObject).to.eql(expectedObject);
        expect(finalObject.a1).to.equal(obj1.a1);
      });
    });
  });

  describe('::replace', () => {
    it('check weather correct values is replaced', () => {
      const obj1 = { a: { b: 'value', c: 'newValue' } };
      const obj2 = { a: { b: 'value1', c: 'newValue1' } };

      const newObj1 = replace(obj1, obj2);
      expect(newObj1).to.eql(obj2);
    });

    it('replace empty values', () => {
      const obj1 = { a1: { a11: 'a11', a12: 'a12' }, b1: 'b', c1: 'c' };
      const obj2 = { a1: { a11: 'a11', a12: 'a12' }, b: { b11: 'b11', b12: 'b12' } };

      const result = replace(obj1, obj2);

      expect(result).to.eql(obj2);
      expect(result).not.to.equal(obj2);

      expect(result.a1).to.equal(obj2.a1);
    });
  });
});
