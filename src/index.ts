import concatLo from 'lodash.concat';
import getLo from 'lodash.get';
import sliceLo from 'lodash.slice';
import toPathLo from 'lodash.topath';

const emptyObject = {};
const emptyArray: any[] = [];

type PathType = (string | number)[] | string | number;
type GenericObject = Record<string, any>;
interface IMergeConfig {
  deep?: boolean;
  mode?: 'merge' | 'replace';
  merger?(object: GenericObject, value: any, config: IMergeConfig): any | void;
}

function isEqual(a: any, b: any): boolean {
  return a === b || (a !== a && b !== b); // Avoid false positives due to (NaN !== NaN) evaluating to true
}

function isMergableObject(target: any) {
  return target !== null && typeof target === 'object' && !Array.isArray(target) && !(target instanceof Date);
}

function instantiateEmptyObject(obj: GenericObject): GenericObject {
  if (obj == null) {
    return {};
  }

  const prototype = Object.getPrototypeOf(obj);
  if (!prototype) {
    return {};
  }

  return Object.create(prototype);
}

function quickCopyArray(src: any[]) {
  if (!Array.isArray(src)) {
    throw new TypeError(`array ${src} should be an array`);
  }

  return src.slice();
}

function quickCopy(src: GenericObject, dest: GenericObject): GenericObject {
  for (const key in src) {
    if (Object.getOwnPropertyDescriptor(src, key)) {
      dest[key] = src[key];
    }
  }

  return dest;
}

function _concat(object: GenericObject, path: PathType, array: any[], direction: -1 | 1) {
  if (!Array.isArray(array)) {
    throw new TypeError(`array ${array} should be an array`);
  }

  return _updateIn(object, toPathLo(path), (obj: any[] = []) => {
    if (!Array.isArray(obj)) {
      throw new TypeError(`object at ${path} should be an array`);
    }

    return direction === 1 ? concatLo(obj, array) : concatLo(array, obj);
  });
}

function _replace(object: GenericObject, value: GenericObject, config?: IMergeConfig): GenericObject {
  // Calling .replace() with no arguments is a no-op. Don't bother cloning.
  if (arguments.length <= 0) {
    return object;
  }

  if (value === null || typeof value !== 'object') {
    throw new TypeError(`Immutable#replace can only be invoked with objects or arrays, not ${JSON.stringify(value)}`);
  }

  const newConfig: IMergeConfig = { ...config };
  newConfig.mode = 'replace';

  return _merge(object, value, newConfig);
}

type IteratorType = (value: any, index: number, array: any[]) => any;
function _flatMap(array: any[], iterator: IteratorType) {
  if (!Array.isArray(array)) {
    throw new TypeError('flatMap can only be applied on arrays');
  }

  // Calling .flatMap() with no arguments is a no-op. Don't bother cloning.
  if (arguments.length <= 1 || typeof iterator !== 'function') {
    return array;
  }

  const result = [];
  const { length } = array;
  let index;

  for (index = 0; index < length; index += 1) {
    const iteratorResult = iterator(array[index], index, array);

    if (Array.isArray(iteratorResult)) {
      // Concatenate Array results into the return value we're building up.
      result.push(...iteratorResult);
    } else {
      // Handle non-Array results the same way map() does.
      result.push(iteratorResult);
    }
  }

  return result;
}

type UpdaterType = (value: any) => any;
function _update(object: GenericObject, key: string | number, updater: UpdaterType, ...args: any[]) {
  const initialVal = object[key];
  if (typeof updater !== 'function') {
    throw new TypeError('Immutable#update: The updater should be a function.');
  }

  return _set(object, key, updater.apply(initialVal, [initialVal].concat(args)));
}

function _updateIn(object: GenericObject, path: PathType, updater: UpdaterType, ...args: any[]) {
  const initialVal = _get(object, path);
  if (typeof updater !== 'function') {
    throw new TypeError('Immutable#updateIn: The updater should be a function.');
  }

  return _setIn(object, path, updater.apply(initialVal, [initialVal].concat(args)));
}

type RemoveType = ((value: any, key: string) => boolean) | string;
function _without(object: GenericObject, remove: RemoveType, ...args: any[]): GenericObject {
  // Calling .without() with no arguments is a no-op. Don't bother cloning.
  if (remove === undefined && arguments.length <= 1) {
    return object;
  }

  if (typeof remove !== 'function') {
    // If we weren't given an array, use the arguments list.
    const keysToRemoveArray: string[] = Array.isArray(remove) ? remove.slice() : Array.prototype.slice.call([remove, ...args]);

    // Convert numeric keys to strings since that's how they'll
    // come from the enumeration of the object.
    keysToRemoveArray.forEach((el: string | number, idx: number, arr: string[]) => {
      if (typeof el === 'number') {
        arr[idx] = el.toString();
      }
    });

    remove = (val, key) => keysToRemoveArray.indexOf(key) !== -1; // tslint:disable-line:no-parameter-reassignment
  }

  const result = instantiateEmptyObject(object);

  for (const key in object) {
    // eslint-disable-next-line no-prototype-builtins
    if (Object.prototype.hasOwnProperty.call(object, key) && remove(object[key], key) === false) {
      result[key] = object[key];
    }
  }

  return result;
}

// tslint:disable-next-line:max-func-body-length
function _merge(object: GenericObject, other: GenericObject, config?: IMergeConfig): GenericObject {
  if (object == null) {
    return other;
  }

  if (other == null) {
    return object;
  }

  // Calling .merge() with no arguments is a no-op. Don't bother cloning.
  if (arguments.length <= 1) {
    return object;
  }

  if (typeof other !== 'object') {
    throw new TypeError(`Immutable#merge can only be invoked with objects or arrays, not ${JSON.stringify(other)}`);
  }

  const receivedArray = Array.isArray(other);
  const deep = _get(config, 'deep', false);
  const mode = _get(config, 'mode', 'merge');
  const merger = _get(config, 'merger');
  let result: GenericObject;

  // Use the given key to extract a value from the given object, then place
  // that value in the result object under the same key. If that resulted
  // in a change from this object's value at that key, set anyChanges = true.
  function addToResult(currentObj: GenericObject, otherObj: GenericObject, key: string) {
    const value = otherObj[key];
    const mergerResult = merger && merger(currentObj[key], value, config);
    const currentValue = currentObj[key];

    if (
      result !== undefined ||
      mergerResult !== undefined ||
      !Object.prototype.hasOwnProperty.call(currentObj, key) ||
      !isEqual(value, currentValue)
    ) {
      let newValue;

      if (mergerResult) {
        newValue = mergerResult;
      } else if (deep && isMergableObject(currentValue) && isMergableObject(value)) {
        newValue = _merge(currentValue, value, config);
      } else {
        newValue = value;
      }

      if (!isEqual(currentValue, newValue) || !Object.prototype.hasOwnProperty.call(currentObj, key)) {
        if (result === undefined) {
          // Make a shallow clone of the current object.
          result = quickCopy(currentObj, instantiateEmptyObject(currentObj));
        }

        result[key] = newValue;
      }
    }
  }

  function clearDroppedKeys(currentObj: GenericObject, otherObj: GenericObject) {
    for (const key in currentObj) {
      if (!Object.prototype.hasOwnProperty.call(otherObj, key)) {
        if (result === undefined) {
          // Make a shallow clone of the current object.
          result = quickCopy(currentObj, instantiateEmptyObject(currentObj));
        }
        delete result[key];
      }
    }
  }

  let key;

  // Achieve prioritization by overriding previous values that get in the way.
  if (!receivedArray) {
    // The most common use case: just merge one object into the existing one.
    for (key in other) {
      if (Object.getOwnPropertyDescriptor(other, key)) {
        addToResult(object, other, key);
      }
    }
    if (mode === 'replace') {
      clearDroppedKeys(object, other);
    }
  } else {
    // We also accept an Array
    // tslint:disable-next-line:one-variable-per-declaration
    for (let index = 0, { length } = other; index < length; index += 1) {
      // tslint:disable-line:one-variable-per-declaration
      const otherFromArray = other[index];

      for (key in otherFromArray) {
        if (Object.prototype.hasOwnProperty.call(otherFromArray, key)) {
          addToResult(result !== undefined ? result : object, otherFromArray, key);
        }
      }
    }
  }

  if (result === undefined) {
    return object;
  }

  return result;
}

function arraySet(array: any[], idx: number, value: any): any[] {
  if (idx in array && isEqual(array[idx], value)) {
    return array;
  }

  const mutable = quickCopyArray(array);
  mutable[idx] = value;

  return mutable;
}

function setInArray(array: any[], path: PathType, value: any) {
  if (!(path instanceof Array) || path.length === 0) {
    throw new TypeError(
      'The first argument to Immutable#setIn must be an array containing at least one "key" string or string of form \'key1.key2.key3\'.'
    );
  }

  // tslint:disable-next-line:prefer-type-cast
  const head: number = path[0] as number;

  if (path.length === 1) {
    return arraySet(array, head, value);
  }
  const tail = path.slice(1);
  const thisHead = array[head];
  let newValue;

  if (typeof thisHead === 'object' && thisHead !== null) {
    // Might (validly) be object or array
    newValue = _setIn(thisHead, tail, value);
  } else {
    const nextHead = tail[0];
    // If the next path part is a number, then we are setting into an array, else an object.
    if (nextHead !== '' && Number.isFinite(nextHead)) {
      newValue = setInArray(emptyArray, tail, value);
    } else {
      newValue = setInObject(emptyObject, tail, value);
    }
  }

  if (head in array && thisHead === newValue) {
    return array;
  }

  const mutable = quickCopyArray(array);
  mutable[head] = newValue;

  return mutable;
}

function objectSet(object: GenericObject, property: string | number, value: any) {
  if (Object.prototype.hasOwnProperty.call(object, property) && isEqual(object[property], value)) {
    return object;
  }

  const mutable = quickCopy(object, instantiateEmptyObject(object));
  mutable[property] = value;

  return mutable;
}

function setInObject(object: GenericObject, path: PathType, value: any) {
  if (!(path instanceof Array) || path.length === 0) {
    throw new TypeError(
      'The first argument to Immutable#setIn must be an array containing at least one "key" string or string of form \'key1.key2.key3\''
    );
  }

  const head: string | number = path[0];

  if (path.length === 1) {
    return objectSet(object, head, value);
  }

  const tail = path.slice(1);
  let newValue;
  const thisHead = object[head];

  if (Object.prototype.hasOwnProperty.call(object, head) && typeof thisHead === 'object' && thisHead !== null) {
    // Might (validly) be object or array
    newValue = _setIn(thisHead, tail, value);
  } else {
    newValue = setInObject(emptyObject, tail, value);
  }

  if (Object.prototype.hasOwnProperty.call(object, head) && thisHead === newValue) {
    return object;
  }

  const mutable = quickCopy(object, instantiateEmptyObject(object));
  mutable[head] = newValue;

  return mutable;
}

function _setIn(object: GenericObject | any[], path: PathType, value: any) {
  if (Array.isArray(object)) {
    return setInArray(object, path, value);
  }

  return setInObject(object, path, value);
}

function _set(object: GenericObject | any[], key: string | number, value: any) {
  if (Array.isArray(object)) {
    return arraySet(object, typeof key === 'number' ? key : Number.parseInt(key, 10), value);
  }

  return objectSet(object, key, value);
}

// tslint:disable-next-line:max-func-body-length
const objectWrapper = (oldObj: GenericObject | any[]) => {
  let finalObj = oldObj;

  const wrappedObject = {
    set: (key: string | number, value: any) => {
      finalObj = _set(finalObj, key, value);

      return wrappedObject;
    },
    setIn: (path: PathType, value: any) => {
      const arrayPath = toPathLo(path);
      finalObj = _setIn(finalObj, arrayPath, value);

      return wrappedObject;
    },
    merge: (other: GenericObject | any[], config: IMergeConfig) => {
      finalObj = _merge(finalObj, other, config);

      return wrappedObject;
    },
    mergeIn: (path: PathType, other: GenericObject | any[], config: IMergeConfig) => {
      const arrayPath = toPathLo(path);
      finalObj = _updateIn(finalObj, arrayPath, (obj) => _merge(obj, other, config));

      return wrappedObject;
    },
    mergeDeep: (other: GenericObject | any[]) => {
      finalObj = _merge(finalObj, other, { deep: true });

      return wrappedObject;
    },
    mergeDeepIn: (path: PathType, other: GenericObject | any[]) => {
      const arrayPath = toPathLo(path);
      finalObj = _updateIn(finalObj, arrayPath, (obj) => _merge(obj, other, { deep: true }));

      return wrappedObject;
    },
    without: (remove: RemoveType, ...args: any[]) => {
      finalObj = _without(finalObj, remove, ...args);

      return wrappedObject;
    },
    update: (key: string | number, updater: UpdaterType, ...args: any[]) => {
      finalObj = _update(finalObj, key, updater, ...args);

      return wrappedObject;
    },
    updateIn: (path: PathType, updater: UpdaterType, ...args: any[]) => {
      const arrayPath = toPathLo(path);
      finalObj = _updateIn(finalObj, arrayPath, updater, ...args);

      return wrappedObject;
    },
    flatMap: (iterator: IteratorType) => {
      // tslint:disable-next-line:prefer-type-cast
      finalObj = _flatMap(finalObj as any[], iterator);

      return wrappedObject;
    },
    replace: (value: GenericObject | any[], config: IMergeConfig) => {
      finalObj = _replace(finalObj, value, config);

      return wrappedObject;
    },
    replaceDeep: (value: GenericObject | any[]) => {
      finalObj = _replace(finalObj, value, { deep: true });

      return wrappedObject;
    },
    concat: (path: PathType, array: any[]) => {
      finalObj = _concat(finalObj, toPathLo(path), array, 1);

      return wrappedObject;
    },
    unshift: (path: PathType, array: any[]) => {
      finalObj = _concat(finalObj, toPathLo(path), array, -1);

      return wrappedObject;
    },
    slice: (start: number, end: number) => {
      if (!Array.isArray(finalObj)) {
        throw new TypeError('slice can only be applied on arrays');
      }

      finalObj = sliceLo(finalObj, start, end);

      return wrappedObject;
    },
    sliceIn: (path: PathType, start: number, end: number) => {
      const value = _get(finalObj, path);
      if (!Array.isArray(value)) {
        throw new TypeError(`value at ${path} should be an array`);
      }

      finalObj = _setIn(finalObj, path, sliceLo(value, start, end));

      return wrappedObject;
    },
    splice: (start: number, deleteCount: number, ...args: any[]) => {
      if (!Array.isArray(finalObj)) {
        throw new TypeError('splice can only be applied on arrays');
      }

      finalObj = splice(finalObj, start, deleteCount, ...args);

      return wrappedObject;
    },
    spliceIn: (path: PathType, start: number, deleteCount: number, ...args: any[]) => {
      const value = _get(finalObj, path);
      if (!Array.isArray(finalObj)) {
        throw new TypeError('splice can only be applied on arrays');
      }

      finalObj = _setIn(finalObj, path, splice(value, start, deleteCount, ...args));

      return wrappedObject;
    },
    value: () => finalObj
  };

  return wrappedObject;
};

/**
 *  -----------  GENERAL  -----------
 */

/**
 * Gets the value at path of object. If the resolved value is undefined, the nonSetValue is returned in its place.
 */
export const _get = getLo;

/**
 * returns a wrapper around {@param object}.
 *
 * usage:
 * const newObject = Immutable.chain(object)
 *                     .setIn('a.b.c', 1)
 *                     .merge({a: {b: {d: 1}}})
 *                     .value()
 *
 */
export const chain = objectWrapper;

/**
 * eg:
 * 1. Immutable.set(object, 'key', 1)
 * 2. Immutable.chain(object).set('key', 1).value()
 *
 * @param object - The main object
 * @param key - property of the object to set
 * @param value - to be set
 */
export const set = _set; // tslint:disable-line:no-reserved-keywords

/**
 * eg:
 * 1. Immutable.setIn(object, 'a.b.c', 1)
 * 2. Immutable.setIn(object, ['a', 'b', 'c'], 1)
 *
 * 3. Immutable.chain(object).setIn(['a', 'b', 'c'], 1).value()
 * 4. Immutable.chain(object).setIn('a.b.c', 1).value()
 *
 * @param object - The main object
 * @param path - property path array of the object to set the value in
 * @param value - to be set
 */
export const setIn = (object: GenericObject | any[], path: PathType, value: any) => _setIn(object, toPathLo(path), value);

/**
 * Returns an Object containing the properties and values of both
 * this object and the provided object, prioritizing the provided object's
 * values whenever the same key is present in both objects.
 *
 * eg:
 * 1. Immutable.merge(object, {a: {b: {d: 1}}})
 * 2. Immutable.merge(object, {a: {b: {d: 1}}}, {deep: true})
 *
 * 3. Immutable.chain(object).merge({a: {b: {d: 1}}}).value()
 * 4. Immutable.chain(object).merge({a: {b: {d: 1}}}, {deep: true}).value()
 *
 * @param object - The main object
 * @param other - The other object to merge. Multiple objects can be passed as an array. In such a case, the later an object appears in
 *                that list, the higher its priority.
 * @param config - { deep: false | true, mode: 'mode | replace', merger: function } Optional config object that contains settings.
 *                          Supported settings are: {deep: true} for deep merge and {merger: mergerFunc} where mergerFunc is a function
 *                          that takes a property from both objects. If anything is returned it overrides the
 *                          normal merge behaviour.
 */
export const merge = _merge;

/**
 * Same as {@link merge} instead this expects a path of keys instead of property.
 *
 * @param object - The main object
 * @param path - key path where we have to merge.
 * @param other - The other object to merge. Multiple objects can be passed as an array. In such a case, the later an object appears in
 *                that list, the higher its priority.
 * @param config - { deep: false | true, mode: 'mode | replace', merger: function } Optional config object that contains settings.
 *                          Supported settings are: {deep: true} for deep merge and {merger: mergerFunc} where mergerFunc is a function
 *                          that takes a property from both objects. If anything is returned it overrides the
 *                          normal merge behaviour.
 */
export function mergeIn(object: GenericObject | any[], path: PathType, other: GenericObject, config: IMergeConfig) {
  // tslint:disable-next-line:no-object-literal-type-assertion prefer-type-cast
  return _updateIn(object, toPathLo(path), (obj) => _merge(obj, other, config || ({} as IMergeConfig)));
}

/**
 * same as merge {@link merge} but with deep=true
 */
export function mergeDeep(object: GenericObject | any[], other: GenericObject | any[], config?: IMergeConfig) {
  return _merge(object, other, { ...config, deep: true });
}

/**
 * same as mergeIn {@link mergeIn} but with deep=true
 */
export function mergeDeepIn(object: GenericObject | any[], path: PathType, other: GenericObject | any[], config: IMergeConfig) {
  return _updateIn(object, toPathLo(path), (obj) => _merge(obj, other, { ...config, deep: true }));
}

/**
 * Returns a copy of the object without the given keys included.
 *
 * eg: const object = {a: 1, b: 2, c: 3, d: 4}
 *
 * 1. Immutable.chain(object).without('a', 'b').value()
 * 2. Immutable.without(object, 'a', 'b')
 * 3. Immutable.without(object, ['a', 'b'])
 * 4. Immutable.without(object, (value, key) => value === 1 || key === 'b')
 * ------- all the above return {c: 3, d: 4}
 *
 * @param object - The main object
 * @param remove - keysToRemove - A list of strings representing the keys to exclude in the return value. Instead of providing a
 *                                single array, this method can also be called by passing multiple strings as separate arguments.
 *                                Instead this can also be called with a function (value, key) return true|false
 */
export const without = _without;

/**
 * Returns an Object with a single property updated using the provided updater function.
 *
 * function inc (x) { return x + 1 }
 * const obj = {foo: 1};
 * Immutable.update(obj, "foo", inc);
 *
 * All additional arguments will be passed to the updater function.
 *
 * function add (x, y) { return x + y }
 * const obj = {foo: 1};
 * Immutable.update(obj, "foo", add, 10);
 *
 * @param object - The main object
 * @param key - property of the object to update the value in.
 * @param updater - updater function called with the value at the given path.
 */
export const update = _update;

/**
 * Like {@link _update}, but accepts a nested path to the property.
 *
 * function add (x, y) { return x + y }
 * const obj = {foo: {bar: 1}};
 * Immutable.updateIn(obj, ["foo", "bar"], add, 10);
 *
 * @param object - The main object
 * @param path - property path array of the object to update the value in
 * @param updater - updater function called with the value at the given path.
 * @param args - any other params
 */
export function updateIn(object: GenericObject | any[], path: PathType, updater: UpdaterType, ...args: any[]) {
  return _updateIn(object, toPathLo(path), updater, ...args);
}

/**
 * Returns an Object containing the properties and values of the second object only. With deep merge, all child objects are checked for
 * equality and the original immutable object is returned when possible.
 * A second argument can be provided to perform a deep merge: {deep: true}.
 *
 * eg:
 * const obj1 = {a: {b: 'test'}, c: 'test'};
 * const obj2 = Immutable.replace(obj1, {a: {b: 'test'}}, {deep: true});
 * returns Immutable.chain(obj1).replace(obj1, {a: {b: 'test'}}, {deep: true}).value();
 *
 * obj1 === obj2
 * returns false
 * obj1.a === obj2.a
 * returns true because child .a objects were identical
 *
 * @param object - The main object
 * @param value - The updater value
 * @param config = {deep: true|false}
 */
export const replace = _replace;

/**
 * same as {@link replace} with deep:true
 *
 * @param object - The main object
 * @param value - The updater value
 */
export function replaceDeep(object: GenericObject, value: GenericObject) {
  const config: IMergeConfig = { deep: true };

  return _replace(object, value, config);
}

/**
 * -----------  ARRAY SPECIFIC  -----------
 */

/**
 * Effectively performs a map over the elements in the array, except that whenever the provided iterator function returns an Array,
 * that Array's elements are each added to the final result.
 *
 * var array = ["drop the numbers!", 3, 2, 1, 0, null, undefined];
 * const func = function(value) {
 *    if (typeof value === "number") {
 *      return [];
 *    } else {
 *      return value;
 *    }
 * }
 * Immutable.flatMap(array, func);
 * Immutable.chain(array).flatMap(func).value();
 * returns ["drop the numbers!", null, undefined]
 *
 */
export const flatMap = _flatMap;

/**
 * Returns a new object with {@param array} concatenated to the value at the {@param path} in the {@param object}
 * throws error if the value at {@param path} or {@param array} is not Array.
 *
 */
export const concat = (object: GenericObject | any[], path: PathType, array: any[]) => _concat(object, toPathLo(path), array, 1);

/**
 * Same as {@link concat} but adds {@param array} at start of value at {@param path} - {@param object}
 */
export const unshift = (object: GenericObject | any[], path: PathType, array: any[]) => _concat(object, toPathLo(path), array, -1);

/**
 * Creates a slice of array from start up to, but not including, end.
 * throws an error if the provided is not an array.
 */
export const slice = (array: any[], start: number, end: number) => {
  if (!Array.isArray(array)) {
    throw new TypeError('slice can only be applied on arrays');
  }

  return sliceLo(array, start, end);
};

/**
 * Creates a slice of array at path of the given object from start up to, but not including, end.
 * throws an error if the value at path is not array.
 */
export const sliceIn = (object: GenericObject | any[], path: PathType, start: number, end: number) => {
  const value = _get(object, path);
  if (!Array.isArray(value)) {
    throw new TypeError(`value at ${path} should be an array`);
  }

  return sliceLo(value, start, end);
};

/**
 * Creates an array after delete {deleteCount}items from start and add the rest items from {start}index
 * throws an error if the value at path is not array.
 */
export const splice = (array: any[], start: number, deleteCount: number, ...items: any[]) => {
  if (!Array.isArray(array)) {
    throw new TypeError('splice can only be applied on arrays');
  }

  const copiedArray = quickCopyArray(array);
  copiedArray.splice(start, deleteCount, ...items);

  return copiedArray;
};

/**
 * Creates an array from the array of the given object after deleting {deleteCount}items from start and add the rest items from {start}index
 * throws an error if the value at path is not array.
 */
export const spliceIn = (object: GenericObject | any[], path: PathType, start: number, deleteCount: number, ...args: any[]) => {
  const value = _get(object, path);
  if (!Array.isArray(value)) {
    throw new TypeError(`value at ${path} should be an array`);
  }

  return setIn(object, path, splice(value, start, deleteCount, ...args));
};

module.exports = {
  chain,
  set,
  setIn,
  merge,
  mergeIn,
  mergeDeep,
  mergeDeepIn,
  without,
  update,
  updateIn,
  get: _get,
  replace,
  replaceDeep,
  flatMap,
  concat,
  unshift,
  slice,
  sliceIn,
  splice,
  spliceIn
};
