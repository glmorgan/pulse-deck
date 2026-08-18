'use strict';

var require$$0$3 = require('events');
var require$$1$1 = require('https');
var require$$2$1 = require('http');
var require$$3 = require('net');
var require$$4 = require('tls');
var require$$1 = require('crypto');
var require$$0$2 = require('stream');
var require$$7 = require('url');
var require$$0 = require('zlib');
var require$$0$1 = require('buffer');
var require$$2 = require('util');
var fs = require('node:fs');
var path = require('node:path');
var node_process = require('node:process');
var node_crypto = require('node:crypto');
var child_process = require('child_process');
var node_http = require('node:http');
var node_child_process = require('node:child_process');
var promises = require('node:fs/promises');
var node_os = require('node:os');

/**
 * Default language supported by all i18n providers.
 */
const defaultLanguage = "en";

/**
 * Creates a {@link IDisposable} that defers the disposing to the {@link dispose} function; disposing is guarded so that it may only occur once.
 * @param dispose Function responsible for disposing.
 * @returns Disposable whereby the disposing is delegated to the {@link dispose}  function.
 */
function deferredDisposable(dispose) {
    let isDisposed = false;
    const guardedDispose = () => {
        if (!isDisposed) {
            dispose();
            isDisposed = true;
        }
    };
    return {
        [Symbol.dispose]: guardedDispose,
        dispose: guardedDispose,
    };
}

/**
 * An event emitter that enables the listening for, and emitting of, events.
 */
let EventEmitter$1 = class EventEmitter {
    /**
     * Underlying collection of events and their listeners.
     */
    events = new Map();
    /**
     * Adds the event {@link listener} for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the {@link listener} added.
     */
    addListener(eventName, listener) {
        return this.add(eventName, listener, (listeners) => listeners.push({ listener }));
    }
    /**
     * Adds the event {@link listener} for the event named {@link eventName}, and returns a disposable capable of removing the event listener.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns A disposable that removes the listener when disposed.
     */
    disposableOn(eventName, listener) {
        this.add(eventName, listener, (listeners) => listeners.push({ listener }));
        return deferredDisposable(() => this.removeListener(eventName, listener));
    }
    /**
     * Emits the {@link eventName}, invoking all event listeners with the specified {@link args}.
     * @param eventName Name of the event.
     * @param args Arguments supplied to each event listener.
     * @returns `true` when there was a listener associated with the event; otherwise `false`.
     */
    emit(eventName, ...args) {
        const listeners = this.events.get(eventName);
        if (listeners === undefined) {
            return false;
        }
        for (let i = 0; i < listeners.length;) {
            const { listener, once } = listeners[i];
            if (once) {
                this.remove(eventName, listeners, i);
            }
            else {
                i++;
            }
            listener(...args);
        }
        return true;
    }
    /**
     * Gets the event names with event listeners.
     * @returns Event names.
     */
    eventNames() {
        return Array.from(this.events.keys());
    }
    /**
     * Gets the number of event listeners for the event named {@link eventName}. When a {@link listener} is defined, only matching event listeners are counted.
     * @param eventName Name of the event.
     * @param listener Optional event listener to count.
     * @returns Number of event listeners.
     */
    listenerCount(eventName, listener) {
        const listeners = this.events.get(eventName);
        if (listeners === undefined || listener == undefined) {
            return listeners?.length || 0;
        }
        let count = 0;
        listeners.forEach((ev) => {
            if (ev.listener === listener) {
                count++;
            }
        });
        return count;
    }
    /**
     * Gets the event listeners for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @returns The event listeners.
     */
    listeners(eventName) {
        return Array.from(this.events.get(eventName) || []).map(({ listener }) => listener);
    }
    /**
     * Removes the event {@link listener} for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the event {@link listener} removed.
     */
    off(eventName, listener) {
        const listeners = this.events.get(eventName) ?? [];
        for (let i = listeners.length - 1; i >= 0; i--) {
            if (listeners[i].listener === listener) {
                this.remove(eventName, listeners, i);
            }
        }
        return this;
    }
    /**
     * Adds the event {@link listener} for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the event {@link listener} added.
     */
    on(eventName, listener) {
        return this.add(eventName, listener, (listeners) => listeners.push({ listener }));
    }
    /**
     * Adds the **one-time** event {@link listener} for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the event {@link listener} added.
     */
    once(eventName, listener) {
        return this.add(eventName, listener, (listeners) => listeners.push({ listener, once: true }));
    }
    /**
     * Adds the event {@link listener} to the beginning of the listeners for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the event {@link listener} prepended.
     */
    prependListener(eventName, listener) {
        return this.add(eventName, listener, (listeners) => listeners.splice(0, 0, { listener }));
    }
    /**
     * Adds the **one-time** event {@link listener} to the beginning of the listeners for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the event {@link listener} prepended.
     */
    prependOnceListener(eventName, listener) {
        return this.add(eventName, listener, (listeners) => listeners.splice(0, 0, { listener, once: true }));
    }
    /**
     * Removes all event listeners for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @returns This instance with the event listeners removed
     */
    removeAllListeners(eventName) {
        const listeners = this.events.get(eventName) ?? [];
        while (listeners.length > 0) {
            this.remove(eventName, listeners, 0);
        }
        this.events.delete(eventName);
        return this;
    }
    /**
     * Removes the event {@link listener} for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the event {@link listener} removed.
     */
    removeListener(eventName, listener) {
        return this.off(eventName, listener);
    }
    /**
     * Adds the event {@link listener} for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @param fn Function responsible for adding the new event handler function.
     * @returns This instance with event {@link listener} added.
     */
    add(eventName, listener, fn) {
        let listeners = this.events.get(eventName);
        if (listeners === undefined) {
            listeners = [];
            this.events.set(eventName, listeners);
        }
        fn(listeners);
        if (eventName !== "newListener") {
            const args = [eventName, listener];
            this.emit("newListener", ...args);
        }
        return this;
    }
    /**
     * Removes the listener at the given index.
     * @param eventName Name of the event.
     * @param listeners Listeners registered with the event.
     * @param index Index of the listener to remove.
     */
    remove(eventName, listeners, index) {
        const [{ listener }] = listeners.splice(index, 1);
        if (eventName !== "removeListener") {
            const args = [eventName, listener];
            this.emit("removeListener", ...args);
        }
    }
};

/**
 * Prevents the modification of existing property attributes and values on the value, and all of its child properties, and prevents the addition of new properties.
 * @param value Value to freeze.
 */
function freeze(value) {
    if (value !== undefined && value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(freeze);
    }
}
/**
 * Gets the value at the specified {@link path}.
 * @param source Source object that is being read from.
 * @param path Path to the property to get.
 * @returns Value of the property.
 */
function get(source, path) {
    const props = path.split(".");
    return props.reduce((obj, prop) => obj && obj[prop], source);
}

/**
 * Internalization provider, responsible for managing localizations and translating resources.
 */
class I18nProvider {
    /**
     * Backing field for the default language.
     */
    #language;
    /**
     * Map of localized resources, indexed by their language.
     */
    #translations = new Map();
    /**
     * Function responsible for providing localized resources for a given language.
     */
    #readTranslations;
    /**
     * Internal events handler.
     */
    #events = new EventEmitter$1();
    /**
     * Initializes a new instance of the {@link I18nProvider} class.
     * @param language The default language to be used when retrieving translations for a given key.
     * @param readTranslations Function responsible for providing localized resources for a given language.
     */
    constructor(language, readTranslations) {
        this.#language = language;
        this.#readTranslations = readTranslations;
    }
    /**
     * The default language of the provider.
     * @returns The language.
     */
    get language() {
        return this.#language;
    }
    /**
     * The default language of the provider.
     * @param value The language.
     */
    set language(value) {
        if (this.#language !== value) {
            this.#language = value;
            this.#events.emit("languageChange", value);
        }
    }
    /**
     * Adds an event listener that is called when the language within the provider changes.
     * @param listener Listener function to be called.
     * @returns Resource manager that, when disposed, removes the event listener.
     */
    onLanguageChange(listener) {
        return this.#events.disposableOn("languageChange", listener);
    }
    /**
     * Translates the specified {@link key}, as defined within the resources for the {@link language}.
     * When the key is not found, the default language is checked. Alias of {@link I18nProvider.translate}.
     * @param key Key of the translation.
     * @param language Optional language to get the translation for; otherwise the default language.
     * @returns The translation; otherwise the key.
     */
    t(key, language = this.language) {
        return this.translate(key, language);
    }
    /**
     * Translates the specified {@link key}, as defined within the resources for the {@link language}.
     * When the key is not found, the default language is checked.
     * @param key Key of the translation.
     * @param language Optional language to get the translation for; otherwise the default language.
     * @returns The translation; otherwise the key.
     */
    translate(key, language = this.language) {
        // Determine the languages to search for.
        const languages = new Set([
            language,
            language.replaceAll("_", "-").split("-").at(0),
            defaultLanguage,
        ]);
        // Attempt to find the resource for the languages.
        for (const language of languages) {
            const resource = get(this.getTranslations(language), key);
            if (resource) {
                return resource.toString();
            }
        }
        // Otherwise fallback to the key.
        return key;
    }
    /**
     * Gets the translations for the specified language.
     * @param language Language whose translations are being retrieved.
     * @returns The translations; otherwise `null`.
     */
    getTranslations(language) {
        let translations = this.#translations.get(language);
        if (translations === undefined) {
            translations = this.#readTranslations(language);
            freeze(translations);
            this.#translations.set(language, translations);
        }
        return translations;
    }
}

/**
 * Provides a read-only iterable collection of items that also acts as a partial polyfill for iterator helpers.
 */
class Enumerable {
    /**
     * Backing function responsible for providing the iterator of items.
     */
    #items;
    /**
     * Backing function for {@link Enumerable.length}.
     */
    #length;
    /**
     * Captured iterator from the underlying iterable; used to fulfil {@link IterableIterator} methods.
     */
    #iterator;
    /**
     * Initializes a new instance of the {@link Enumerable} class.
     * @param source Source that contains the items.
     * @returns The enumerable.
     */
    constructor(source) {
        if (source instanceof Enumerable) {
            // Enumerable
            this.#items = source.#items;
            this.#length = source.#length;
        }
        else if (Array.isArray(source)) {
            // Array
            this.#items = () => source.values();
            this.#length = () => source.length;
        }
        else if (source instanceof Map || source instanceof Set) {
            // Map or Set
            this.#items = () => source.values();
            this.#length = () => source.size;
        }
        else {
            // IterableIterator delegate
            this.#items = source;
            this.#length = () => {
                let i = 0;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                for (const _ of this) {
                    i++;
                }
                return i;
            };
        }
    }
    /**
     * Gets the number of items in the enumerable.
     * @returns The number of items.
     */
    get length() {
        return this.#length();
    }
    /**
     * Gets the iterator for the enumerable.
     * @yields The items.
     */
    *[Symbol.iterator]() {
        for (const item of this.#items()) {
            yield item;
        }
    }
    /**
     * Transforms each item within this iterator to an indexed pair, with each pair represented as an array.
     * @returns An iterator of indexed pairs.
     */
    asIndexedPairs() {
        return new Enumerable(function* () {
            let i = 0;
            for (const item of this) {
                yield [i++, item];
            }
        }.bind(this));
    }
    /**
     * Returns an iterator with the first items dropped, up to the specified limit.
     * @param limit The number of elements to drop from the start of the iteration.
     * @returns An iterator of items after the limit.
     */
    drop(limit) {
        if (isNaN(limit) || limit < 0) {
            throw new RangeError("limit must be 0, or a positive number");
        }
        return new Enumerable(function* () {
            let i = 0;
            for (const item of this) {
                if (i++ >= limit) {
                    yield item;
                }
            }
        }.bind(this));
    }
    /**
     * Determines whether all items satisfy the specified predicate.
     * @param predicate Function that determines whether each item fulfils the predicate.
     * @returns `true` when all items satisfy the predicate; otherwise `false`.
     */
    every(predicate) {
        for (const item of this) {
            if (!predicate(item)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Returns an iterator of items that meet the specified predicate..
     * @param predicate Function that determines which items to filter.
     * @returns An iterator of filtered items.
     */
    filter(predicate) {
        return new Enumerable(function* () {
            for (const item of this) {
                if (predicate(item)) {
                    yield item;
                }
            }
        }.bind(this));
    }
    /**
     * Finds the first item that satisfies the specified predicate.
     * @param predicate Predicate to match items against.
     * @returns The first item that satisfied the predicate; otherwise `undefined`.
     */
    find(predicate) {
        for (const item of this) {
            if (predicate(item)) {
                return item;
            }
        }
    }
    /**
     * Finds the last item that satisfies the specified predicate.
     * @param predicate Predicate to match items against.
     * @returns The first item that satisfied the predicate; otherwise `undefined`.
     */
    findLast(predicate) {
        let result = undefined;
        for (const item of this) {
            if (predicate(item)) {
                result = item;
            }
        }
        return result;
    }
    /**
     * Returns an iterator containing items transformed using the specified mapper function.
     * @param mapper Function responsible for transforming each item.
     * @returns An iterator of transformed items.
     */
    flatMap(mapper) {
        return new Enumerable(function* () {
            for (const item of this) {
                for (const mapped of mapper(item)) {
                    yield mapped;
                }
            }
        }.bind(this));
    }
    /**
     * Iterates over each item, and invokes the specified function.
     * @param fn Function to invoke against each item.
     */
    forEach(fn) {
        for (const item of this) {
            fn(item);
        }
    }
    /**
     * Determines whether the search item exists in the collection exists.
     * @param search Item to search for.
     * @returns `true` when the item was found; otherwise `false`.
     */
    includes(search) {
        return this.some((item) => item === search);
    }
    /**
     * Returns an iterator of mapped items using the mapper function.
     * @param mapper Function responsible for mapping the items.
     * @returns An iterator of mapped items.
     */
    map(mapper) {
        return new Enumerable(function* () {
            for (const item of this) {
                yield mapper(item);
            }
        }.bind(this));
    }
    /**
     * Captures the underlying iterable, if it is not already captured, and gets the next item in the iterator.
     * @param args Optional values to send to the generator.
     * @returns An iterator result of the current iteration; when `done` is `false`, the current `value` is provided.
     */
    next(...args) {
        this.#iterator ??= this.#items();
        const result = this.#iterator.next(...args);
        if (result.done) {
            this.#iterator = undefined;
        }
        return result;
    }
    /**
     * Applies the accumulator function to each item, and returns the result.
     * @param accumulator Function responsible for accumulating all items within the collection.
     * @param initial Initial value supplied to the accumulator.
     * @returns Result of accumulating each value.
     */
    reduce(accumulator, initial) {
        if (this.length === 0) {
            if (initial === undefined) {
                throw new TypeError("Reduce of empty enumerable with no initial value.");
            }
            return initial;
        }
        let result = initial;
        for (const item of this) {
            if (result === undefined) {
                result = item;
            }
            else {
                result = accumulator(result, item);
            }
        }
        return result;
    }
    /**
     * Acts as if a `return` statement is inserted in the generator's body at the current suspended position.
     *
     * Please note, in the context of an {@link Enumerable}, calling {@link Enumerable.return} will clear the captured iterator,
     * if there is one. Subsequent calls to {@link Enumerable.next} will result in re-capturing the underlying iterable, and
     * yielding items from the beginning.
     * @param value Value to return.
     * @returns The value as an iterator result.
     */
    return(value) {
        this.#iterator = undefined;
        return { done: true, value };
    }
    /**
     * Determines whether an item in the collection exists that satisfies the specified predicate.
     * @param predicate Function used to search for an item.
     * @returns `true` when the item was found; otherwise `false`.
     */
    some(predicate) {
        for (const item of this) {
            if (predicate(item)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Returns an iterator with the items, from 0, up to the specified limit.
     * @param limit Limit of items to take.
     * @returns An iterator of items from 0 to the limit.
     */
    take(limit) {
        if (isNaN(limit) || limit < 0) {
            throw new RangeError("limit must be 0, or a positive number");
        }
        return new Enumerable(function* () {
            let i = 0;
            for (const item of this) {
                if (i++ < limit) {
                    yield item;
                }
            }
        }.bind(this));
    }
    /**
     * Acts as if a `throw` statement is inserted in the generator's body at the current suspended position.
     * @param e Error to throw.
     */
    throw(e) {
        throw e;
    }
    /**
     * Converts this iterator to an array.
     * @returns The array of items from this iterator.
     */
    toArray() {
        return Array.from(this);
    }
    /**
     * Converts this iterator to serializable collection.
     * @returns The serializable collection of items.
     */
    toJSON() {
        return this.toArray();
    }
    /**
     * Converts this iterator to a string.
     * @returns The string.
     */
    toString() {
        return `${this.toArray()}`;
    }
}

// Polyfill, explicit resource management https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#using-declarations-and-explicit-resource-management
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Symbol.dispose ??= Symbol("Symbol.dispose");

/**
 * Provides a wrapper around a value that is lazily instantiated.
 */
class Lazy {
    /**
     * Private backing field for {@link Lazy.value}.
     */
    #value = undefined;
    /**
     * Factory responsible for instantiating the value.
     */
    #valueFactory;
    /**
     * Initializes a new instance of the {@link Lazy} class.
     * @param valueFactory The factory responsible for instantiating the value.
     */
    constructor(valueFactory) {
        this.#valueFactory = valueFactory;
    }
    /**
     * Gets the value.
     * @returns The value.
     */
    get value() {
        if (this.#value === undefined) {
            this.#value = this.#valueFactory();
        }
        return this.#value;
    }
}

/**
 * Returns an object that contains a promise and two functions to resolve or reject it.
 * @returns The promise, and the resolve and reject functions.
 */
function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/** A special constant with type `never` */
function $constructor(name, initializer, params) {
    function init(inst, def) {
        var _a;
        Object.defineProperty(inst, "_zod", {
            value: inst._zod ?? {},
            enumerable: false,
        });
        (_a = inst._zod).traits ?? (_a.traits = new Set());
        inst._zod.traits.add(name);
        initializer(inst, def);
        // support prototype modifications
        for (const k in _.prototype) {
            if (!(k in inst))
                Object.defineProperty(inst, k, { value: _.prototype[k].bind(inst) });
        }
        inst._zod.constr = _;
        inst._zod.def = def;
    }
    // doesn't work if Parent has a constructor with arguments
    const Parent = params?.Parent ?? Object;
    class Definition extends Parent {
    }
    Object.defineProperty(Definition, "name", { value: name });
    function _(def) {
        var _a;
        const inst = params?.Parent ? new Definition() : this;
        init(inst, def);
        (_a = inst._zod).deferred ?? (_a.deferred = []);
        for (const fn of inst._zod.deferred) {
            fn();
        }
        return inst;
    }
    Object.defineProperty(_, "init", { value: init });
    Object.defineProperty(_, Symbol.hasInstance, {
        value: (inst) => {
            if (params?.Parent && inst instanceof params.Parent)
                return true;
            return inst?._zod?.traits?.has(name);
        },
    });
    Object.defineProperty(_, "name", { value: name });
    return _;
}
class $ZodAsyncError extends Error {
    constructor() {
        super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
    }
}
const globalConfig = {};
function config(newConfig) {
    return globalConfig;
}

// functions
function jsonStringifyReplacer(_, value) {
    if (typeof value === "bigint")
        return value.toString();
    return value;
}
function cached(getter) {
    return {
        get value() {
            {
                const value = getter();
                Object.defineProperty(this, "value", { value });
                return value;
            }
        },
    };
}
function cleanRegex(source) {
    const start = source.startsWith("^") ? 1 : 0;
    const end = source.endsWith("$") ? source.length - 1 : source.length;
    return source.slice(start, end);
}
function defineLazy(object, key, getter) {
    Object.defineProperty(object, key, {
        get() {
            {
                const value = getter();
                object[key] = value;
                return value;
            }
        },
        set(v) {
            Object.defineProperty(object, key, {
                value: v,
                // configurable: true,
            });
            // object[key] = v;
        },
        configurable: true,
    });
}
function assignProp(target, prop, value) {
    Object.defineProperty(target, prop, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
    });
}
function esc(str) {
    return JSON.stringify(str);
}
const captureStackTrace = Error.captureStackTrace
    ? Error.captureStackTrace
    : (..._args) => { };
function isObject(data) {
    return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = cached(() => {
    if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
        return false;
    }
    try {
        const F = Function;
        new F("");
        return true;
    }
    catch (_) {
        return false;
    }
});
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// zod-specific utils
function clone(inst, def, params) {
    const cl = new inst._zod.constr(def ?? inst._zod.def);
    if (!def || params?.parent)
        cl._zod.parent = inst;
    return cl;
}
function normalizeParams(_params) {
    return {};
}
function optionalKeys(shape) {
    return Object.keys(shape).filter((k) => {
        return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
    });
}
function aborted(x, startIndex = 0) {
    for (let i = startIndex; i < x.issues.length; i++) {
        if (x.issues[i]?.continue !== true)
            return true;
    }
    return false;
}
function prefixIssues(path, issues) {
    return issues.map((iss) => {
        var _a;
        (_a = iss).path ?? (_a.path = []);
        iss.path.unshift(path);
        return iss;
    });
}
function unwrapMessage(message) {
    return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config) {
    const full = { ...iss, path: iss.path ?? [] };
    // for backwards compatibility
    if (!iss.message) {
        const message = unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ??
            unwrapMessage(ctx?.error?.(iss)) ??
            unwrapMessage(config.customError?.(iss)) ??
            unwrapMessage(config.localeError?.(iss)) ??
            "Invalid input";
        full.message = message;
    }
    // delete (full as any).def;
    delete full.inst;
    delete full.continue;
    if (!ctx?.reportInput) {
        delete full.input;
    }
    return full;
}

const initializer = (inst, def) => {
    inst.name = "$ZodError";
    Object.defineProperty(inst, "_zod", {
        value: inst._zod,
        enumerable: false,
    });
    Object.defineProperty(inst, "issues", {
        value: def,
        enumerable: false,
    });
    Object.defineProperty(inst, "message", {
        get() {
            return JSON.stringify(def, jsonStringifyReplacer, 2);
        },
        enumerable: true,
        // configurable: false,
    });
    Object.defineProperty(inst, "toString", {
        value: () => inst.message,
        enumerable: false,
    });
};
const $ZodError = $constructor("$ZodError", initializer);
const $ZodRealError = $constructor("$ZodError", initializer, { Parent: Error });

const _parse = (_Err) => (schema, value, _ctx, _params) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: false }) : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
        throw new $ZodAsyncError();
    }
    if (result.issues.length) {
        const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
        captureStackTrace(e, _params?.callee);
        throw e;
    }
    return result.value;
};
const parse$2 = /* @__PURE__*/ _parse($ZodRealError);
const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
        result = await result;
    if (result.issues.length) {
        const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
        captureStackTrace(e, params?.callee);
        throw e;
    }
    return result.value;
};
const parseAsync = /* @__PURE__*/ _parseAsync($ZodRealError);
const _safeParse = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
        throw new $ZodAsyncError();
    }
    return result.issues.length
        ? {
            success: false,
            error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config()))),
        }
        : { success: true, data: result.value };
};
const safeParse = /* @__PURE__*/ _safeParse($ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
        result = await result;
    return result.issues.length
        ? {
            success: false,
            error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config()))),
        }
        : { success: true, data: result.value };
};
const safeParseAsync = /* @__PURE__*/ _safeParseAsync($ZodRealError);

const string$1 = (params) => {
    const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
    return new RegExp(`^${regex}$`);
};
const number$1 = /^-?\d+(?:\.\d+)?/i;
const boolean$1 = /true|false/i;

class Doc {
    constructor(args = []) {
        this.content = [];
        this.indent = 0;
        if (this)
            this.args = args;
    }
    indented(fn) {
        this.indent += 1;
        fn(this);
        this.indent -= 1;
    }
    write(arg) {
        if (typeof arg === "function") {
            arg(this, { execution: "sync" });
            arg(this, { execution: "async" });
            return;
        }
        const content = arg;
        const lines = content.split("\n").filter((x) => x);
        const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
        const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
        for (const line of dedented) {
            this.content.push(line);
        }
    }
    compile() {
        const F = Function;
        const args = this?.args;
        const content = this?.content ?? [``];
        const lines = [...content.map((x) => `  ${x}`)];
        // console.log(lines.join("\n"));
        return new F(...args, lines.join("\n"));
    }
}

const version = {
    major: 4,
    minor: 0,
    patch: 0,
};

const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
    var _a;
    inst ?? (inst = {});
    inst._zod.def = def; // set _def property
    inst._zod.bag = inst._zod.bag || {}; // initialize _bag object
    inst._zod.version = version;
    const checks = [...(inst._zod.def.checks ?? [])];
    // if inst is itself a checks.$ZodCheck, run it as a check
    if (inst._zod.traits.has("$ZodCheck")) {
        checks.unshift(inst);
    }
    //
    for (const ch of checks) {
        for (const fn of ch._zod.onattach) {
            fn(inst);
        }
    }
    if (checks.length === 0) {
        // deferred initializer
        // inst._zod.parse is not yet defined
        (_a = inst._zod).deferred ?? (_a.deferred = []);
        inst._zod.deferred?.push(() => {
            inst._zod.run = inst._zod.parse;
        });
    }
    else {
        const runChecks = (payload, checks, ctx) => {
            let isAborted = aborted(payload);
            let asyncResult;
            for (const ch of checks) {
                if (ch._zod.def.when) {
                    const shouldRun = ch._zod.def.when(payload);
                    if (!shouldRun)
                        continue;
                }
                else if (isAborted) {
                    continue;
                }
                const currLen = payload.issues.length;
                const _ = ch._zod.check(payload);
                if (_ instanceof Promise && ctx?.async === false) {
                    throw new $ZodAsyncError();
                }
                if (asyncResult || _ instanceof Promise) {
                    asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
                        await _;
                        const nextLen = payload.issues.length;
                        if (nextLen === currLen)
                            return;
                        if (!isAborted)
                            isAborted = aborted(payload, currLen);
                    });
                }
                else {
                    const nextLen = payload.issues.length;
                    if (nextLen === currLen)
                        continue;
                    if (!isAborted)
                        isAborted = aborted(payload, currLen);
                }
            }
            if (asyncResult) {
                return asyncResult.then(() => {
                    return payload;
                });
            }
            return payload;
        };
        inst._zod.run = (payload, ctx) => {
            const result = inst._zod.parse(payload, ctx);
            if (result instanceof Promise) {
                if (ctx.async === false)
                    throw new $ZodAsyncError();
                return result.then((result) => runChecks(result, checks, ctx));
            }
            return runChecks(result, checks, ctx);
        };
    }
    inst["~standard"] = {
        validate: (value) => {
            try {
                const r = safeParse(inst, value);
                return r.success ? { value: r.data } : { issues: r.error?.issues };
            }
            catch (_) {
                return safeParseAsync(inst, value).then((r) => (r.success ? { value: r.data } : { issues: r.error?.issues }));
            }
        },
        vendor: "zod",
        version: 1,
    };
});
const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = [...(inst?._zod.bag?.patterns ?? [])].pop() ?? string$1(inst._zod.bag);
    inst._zod.parse = (payload, _) => {
        if (def.coerce)
            try {
                payload.value = String(payload.value);
            }
            catch (_) { }
        if (typeof payload.value === "string")
            return payload;
        payload.issues.push({
            expected: "string",
            code: "invalid_type",
            input: payload.value,
            inst,
        });
        return payload;
    };
});
const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
    inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
            try {
                payload.value = Number(payload.value);
            }
            catch (_) { }
        const input = payload.value;
        if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
            return payload;
        }
        const received = typeof input === "number"
            ? Number.isNaN(input)
                ? "NaN"
                : !Number.isFinite(input)
                    ? "Infinity"
                    : undefined
            : undefined;
        payload.issues.push({
            expected: "number",
            code: "invalid_type",
            input,
            inst,
            ...(received ? { received } : {}),
        });
        return payload;
    };
});
const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = boolean$1;
    inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
            try {
                payload.value = Boolean(payload.value);
            }
            catch (_) { }
        const input = payload.value;
        if (typeof input === "boolean")
            return payload;
        payload.issues.push({
            expected: "boolean",
            code: "invalid_type",
            input,
            inst,
        });
        return payload;
    };
});
function handleArrayResult(result, final, index) {
    if (result.issues.length) {
        final.issues.push(...prefixIssues(index, result.issues));
    }
    final.value[index] = result.value;
}
const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!Array.isArray(input)) {
            payload.issues.push({
                expected: "array",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        payload.value = Array(input.length);
        const proms = [];
        for (let i = 0; i < input.length; i++) {
            const item = input[i];
            const result = def.element._zod.run({
                value: item,
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                proms.push(result.then((result) => handleArrayResult(result, payload, i)));
            }
            else {
                handleArrayResult(result, payload, i);
            }
        }
        if (proms.length) {
            return Promise.all(proms).then(() => payload);
        }
        return payload; //handleArrayResultsAsync(parseResults, final);
    };
});
function handleObjectResult(result, final, key) {
    // if(isOptional)
    if (result.issues.length) {
        final.issues.push(...prefixIssues(key, result.issues));
    }
    final.value[key] = result.value;
}
function handleOptionalObjectResult(result, final, key, input) {
    if (result.issues.length) {
        // validation failed against value schema
        if (input[key] === undefined) {
            // if input was undefined, ignore the error
            if (key in input) {
                final.value[key] = undefined;
            }
            else {
                final.value[key] = result.value;
            }
        }
        else {
            final.issues.push(...prefixIssues(key, result.issues));
        }
    }
    else if (result.value === undefined) {
        // validation returned `undefined`
        if (key in input)
            final.value[key] = undefined;
    }
    else {
        // non-undefined value
        final.value[key] = result.value;
    }
}
const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
    // requires cast because technically $ZodObject doesn't extend
    $ZodType.init(inst, def);
    const _normalized = cached(() => {
        const keys = Object.keys(def.shape);
        for (const k of keys) {
            if (!(def.shape[k] instanceof $ZodType)) {
                throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
            }
        }
        const okeys = optionalKeys(def.shape);
        return {
            shape: def.shape,
            keys,
            keySet: new Set(keys),
            numKeys: keys.length,
            optionalKeys: new Set(okeys),
        };
    });
    defineLazy(inst._zod, "propValues", () => {
        const shape = def.shape;
        const propValues = {};
        for (const key in shape) {
            const field = shape[key]._zod;
            if (field.values) {
                propValues[key] ?? (propValues[key] = new Set());
                for (const v of field.values)
                    propValues[key].add(v);
            }
        }
        return propValues;
    });
    const generateFastpass = (shape) => {
        const doc = new Doc(["shape", "payload", "ctx"]);
        const normalized = _normalized.value;
        const parseStr = (key) => {
            const k = esc(key);
            return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
        };
        doc.write(`const input = payload.value;`);
        const ids = Object.create(null);
        let counter = 0;
        for (const key of normalized.keys) {
            ids[key] = `key_${counter++}`;
        }
        // A: preserve key order {
        doc.write(`const newResult = {}`);
        for (const key of normalized.keys) {
            if (normalized.optionalKeys.has(key)) {
                const id = ids[key];
                doc.write(`const ${id} = ${parseStr(key)};`);
                const k = esc(key);
                doc.write(`
        if (${id}.issues.length) {
          if (input[${k}] === undefined) {
            if (${k} in input) {
              newResult[${k}] = undefined;
            }
          } else {
            payload.issues = payload.issues.concat(
              ${id}.issues.map((iss) => ({
                ...iss,
                path: iss.path ? [${k}, ...iss.path] : [${k}],
              }))
            );
          }
        } else if (${id}.value === undefined) {
          if (${k} in input) newResult[${k}] = undefined;
        } else {
          newResult[${k}] = ${id}.value;
        }
        `);
            }
            else {
                const id = ids[key];
                //  const id = ids[key];
                doc.write(`const ${id} = ${parseStr(key)};`);
                doc.write(`
          if (${id}.issues.length) payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${esc(key)}, ...iss.path] : [${esc(key)}]
          })));`);
                doc.write(`newResult[${esc(key)}] = ${id}.value`);
            }
        }
        doc.write(`payload.value = newResult;`);
        doc.write(`return payload;`);
        const fn = doc.compile();
        return (payload, ctx) => fn(shape, payload, ctx);
    };
    let fastpass;
    const isObject$1 = isObject;
    const jit = !globalConfig.jitless;
    const allowsEval$1 = allowsEval;
    const fastEnabled = jit && allowsEval$1.value; // && !def.catchall;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
        value ?? (value = _normalized.value);
        const input = payload.value;
        if (!isObject$1(input)) {
            payload.issues.push({
                expected: "object",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        const proms = [];
        if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
            // always synchronous
            if (!fastpass)
                fastpass = generateFastpass(def.shape);
            payload = fastpass(payload, ctx);
        }
        else {
            payload.value = {};
            const shape = value.shape;
            for (const key of value.keys) {
                const el = shape[key];
                // do not add omitted optional keys
                // if (!(key in input)) {
                //   if (optionalKeys.has(key)) continue;
                //   payload.issues.push({
                //     code: "invalid_type",
                //     path: [key],
                //     expected: "nonoptional",
                //     note: `Missing required key: "${key}"`,
                //     input,
                //     inst,
                //   });
                // }
                const r = el._zod.run({ value: input[key], issues: [] }, ctx);
                const isOptional = el._zod.optin === "optional" && el._zod.optout === "optional";
                if (r instanceof Promise) {
                    proms.push(r.then((r) => isOptional ? handleOptionalObjectResult(r, payload, key, input) : handleObjectResult(r, payload, key)));
                }
                else if (isOptional) {
                    handleOptionalObjectResult(r, payload, key, input);
                }
                else {
                    handleObjectResult(r, payload, key);
                }
            }
        }
        if (!catchall) {
            // return payload;
            return proms.length ? Promise.all(proms).then(() => payload) : payload;
        }
        const unrecognized = [];
        // iterate over input keys
        const keySet = value.keySet;
        const _catchall = catchall._zod;
        const t = _catchall.def.type;
        for (const key of Object.keys(input)) {
            if (keySet.has(key))
                continue;
            if (t === "never") {
                unrecognized.push(key);
                continue;
            }
            const r = _catchall.run({ value: input[key], issues: [] }, ctx);
            if (r instanceof Promise) {
                proms.push(r.then((r) => handleObjectResult(r, payload, key)));
            }
            else {
                handleObjectResult(r, payload, key);
            }
        }
        if (unrecognized.length) {
            payload.issues.push({
                code: "unrecognized_keys",
                keys: unrecognized,
                input,
                inst,
            });
        }
        if (!proms.length)
            return payload;
        return Promise.all(proms).then(() => {
            return payload;
        });
    };
});
function handleUnionResults(results, final, inst, ctx) {
    for (const result of results) {
        if (result.issues.length === 0) {
            final.value = result.value;
            return final;
        }
    }
    final.issues.push({
        code: "invalid_union",
        input: final.value,
        inst,
        errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config()))),
    });
    return final;
}
const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : undefined);
    defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : undefined);
    defineLazy(inst._zod, "values", () => {
        if (def.options.every((o) => o._zod.values)) {
            return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
        }
        return undefined;
    });
    defineLazy(inst._zod, "pattern", () => {
        if (def.options.every((o) => o._zod.pattern)) {
            const patterns = def.options.map((o) => o._zod.pattern);
            return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
        }
        return undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        let async = false;
        const results = [];
        for (const option of def.options) {
            const result = option._zod.run({
                value: payload.value,
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                results.push(result);
                async = true;
            }
            else {
                if (result.issues.length === 0)
                    return result;
                results.push(result);
            }
        }
        if (!async)
            return handleUnionResults(results, payload, inst, ctx);
        return Promise.all(results).then((results) => {
            return handleUnionResults(results, payload, inst, ctx);
        });
    };
});
const $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.values = new Set(def.values);
    inst._zod.pattern = new RegExp(`^(${def.values
        .map((o) => (typeof o === "string" ? escapeRegex(o) : o ? o.toString() : String(o)))
        .join("|")})$`);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (inst._zod.values.has(input)) {
            return payload;
        }
        payload.issues.push({
            code: "invalid_value",
            values: def.values,
            input,
            inst,
        });
        return payload;
    };
});
const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    inst._zod.optout = "optional";
    defineLazy(inst._zod, "values", () => {
        return def.innerType._zod.values ? new Set([...def.innerType._zod.values, undefined]) : undefined;
    });
    defineLazy(inst._zod, "pattern", () => {
        const pattern = def.innerType._zod.pattern;
        return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        if (def.innerType._zod.optin === "optional") {
            return def.innerType._zod.run(payload, ctx);
        }
        if (payload.value === undefined) {
            return payload;
        }
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodLazy = /*@__PURE__*/ $constructor("$ZodLazy", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "innerType", () => def.getter());
    defineLazy(inst._zod, "pattern", () => inst._zod.innerType._zod.pattern);
    defineLazy(inst._zod, "propValues", () => inst._zod.innerType._zod.propValues);
    defineLazy(inst._zod, "optin", () => inst._zod.innerType._zod.optin);
    defineLazy(inst._zod, "optout", () => inst._zod.innerType._zod.optout);
    inst._zod.parse = (payload, ctx) => {
        const inner = inst._zod.innerType;
        return inner._zod.run(payload, ctx);
    };
});

function _string(Class, params) {
    return new Class({
        type: "string",
        ...normalizeParams(),
    });
}
function _number(Class, params) {
    return new Class({
        type: "number",
        checks: [],
        ...normalizeParams(),
    });
}
function _boolean(Class, params) {
    return new Class({
        type: "boolean",
        ...normalizeParams(),
    });
}

const ZodMiniType = /*@__PURE__*/ $constructor("ZodMiniType", (inst, def) => {
    if (!inst._zod)
        throw new Error("Uninitialized schema in ZodMiniType.");
    $ZodType.init(inst, def);
    inst.def = def;
    inst.parse = (data, params) => parse$2(inst, data, params, { callee: inst.parse });
    inst.safeParse = (data, params) => safeParse(inst, data, params);
    inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
    inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
    inst.check = (...checks) => {
        return inst.clone({
            ...def,
            checks: [
                ...(def.checks ?? []),
                ...checks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch),
            ],
        }
        // { parent: true }
        );
    };
    inst.clone = (_def, params) => clone(inst, _def, params);
    inst.brand = () => inst;
    inst.register = ((reg, meta) => {
        reg.add(inst, meta);
        return inst;
    });
});
const ZodMiniString = /*@__PURE__*/ $constructor("ZodMiniString", (inst, def) => {
    $ZodString.init(inst, def);
    ZodMiniType.init(inst, def);
});
function string(params) {
    return _string(ZodMiniString);
}
const ZodMiniNumber = /*@__PURE__*/ $constructor("ZodMiniNumber", (inst, def) => {
    $ZodNumber.init(inst, def);
    ZodMiniType.init(inst, def);
});
function number(params) {
    return _number(ZodMiniNumber);
}
const ZodMiniBoolean = /*@__PURE__*/ $constructor("ZodMiniBoolean", (inst, def) => {
    $ZodBoolean.init(inst, def);
    ZodMiniType.init(inst, def);
});
function boolean(params) {
    return _boolean(ZodMiniBoolean);
}
const ZodMiniArray = /*@__PURE__*/ $constructor("ZodMiniArray", (inst, def) => {
    $ZodArray.init(inst, def);
    ZodMiniType.init(inst, def);
});
function array(element, params) {
    return new ZodMiniArray({
        type: "array",
        element: element,
        ...normalizeParams(),
    });
}
const ZodMiniObject = /*@__PURE__*/ $constructor("ZodMiniObject", (inst, def) => {
    $ZodObject.init(inst, def);
    ZodMiniType.init(inst, def);
    defineLazy(inst, "shape", () => def.shape);
});
function object(shape, params) {
    const def = {
        type: "object",
        get shape() {
            assignProp(this, "shape", { ...shape });
            return this.shape;
        },
        ...normalizeParams(),
    };
    return new ZodMiniObject(def);
}
const ZodMiniUnion = /*@__PURE__*/ $constructor("ZodMiniUnion", (inst, def) => {
    $ZodUnion.init(inst, def);
    ZodMiniType.init(inst, def);
});
function union(options, params) {
    return new ZodMiniUnion({
        type: "union",
        options: options,
        ...normalizeParams(),
    });
}
const ZodMiniLiteral = /*@__PURE__*/ $constructor("ZodMiniLiteral", (inst, def) => {
    $ZodLiteral.init(inst, def);
    ZodMiniType.init(inst, def);
});
function literal(value, params) {
    return new ZodMiniLiteral({
        type: "literal",
        values: Array.isArray(value) ? value : [value],
        ...normalizeParams(),
    });
}
const ZodMiniOptional = /*@__PURE__*/ $constructor("ZodMiniOptional", (inst, def) => {
    $ZodOptional.init(inst, def);
    ZodMiniType.init(inst, def);
});
function optional(innerType) {
    return new ZodMiniOptional({
        type: "optional",
        innerType: innerType,
    });
}
const ZodMiniLazy = /*@__PURE__*/ $constructor("ZodMiniLazy", (inst, def) => {
    $ZodLazy.init(inst, def);
    ZodMiniType.init(inst, def);
});
// export function lazy<T extends object>(getter: () => T): T {
//   return util.createTransparentProxy<T>(getter);
// }
function _lazy(getter) {
    return new ZodMiniLazy({
        type: "lazy",
        getter: getter,
    });
}

/**
 * Serializable structure that represents an option.
 */
const Option = object({
    type: literal("option"),
    disabled: optional(boolean()),
    label: string(),
    value: union([boolean(), number(), string()]),
});

/**
 * Serializable structure that represents a group of options.
 */
const OptionGroup = object({
    type: literal("option-group"),
    disabled: optional(boolean()),
    options: _lazy(() => array(union([Option, OptionGroup]))),
    label: string(),
});

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var bufferUtil$1 = {exports: {}};

const BINARY_TYPES$2 = ['nodebuffer', 'arraybuffer', 'fragments'];
const hasBlob$1 = typeof Blob !== 'undefined';

if (hasBlob$1) BINARY_TYPES$2.push('blob');

var constants = {
  BINARY_TYPES: BINARY_TYPES$2,
  CLOSE_TIMEOUT: 30000,
  EMPTY_BUFFER: Buffer.alloc(0),
  GUID: '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
  hasBlob: hasBlob$1,
  kForOnEventAttribute: Symbol('kIsForOnEventAttribute'),
  kListener: Symbol('kListener'),
  kStatusCode: Symbol('status-code'),
  kWebSocket: Symbol('websocket'),
  NOOP: () => {}
};

var unmask$1;
var mask;

const { EMPTY_BUFFER: EMPTY_BUFFER$3 } = constants;

const FastBuffer$2 = Buffer[Symbol.species];

/**
 * Merges an array of buffers into a new buffer.
 *
 * @param {Buffer[]} list The array of buffers to concat
 * @param {Number} totalLength The total length of buffers in the list
 * @return {Buffer} The resulting buffer
 * @public
 */
function concat$1(list, totalLength) {
  if (list.length === 0) return EMPTY_BUFFER$3;
  if (list.length === 1) return list[0];

  const target = Buffer.allocUnsafe(totalLength);
  let offset = 0;

  for (let i = 0; i < list.length; i++) {
    const buf = list[i];
    target.set(buf, offset);
    offset += buf.length;
  }

  if (offset < totalLength) {
    return new FastBuffer$2(target.buffer, target.byteOffset, offset);
  }

  return target;
}

/**
 * Masks a buffer using the given mask.
 *
 * @param {Buffer} source The buffer to mask
 * @param {Buffer} mask The mask to use
 * @param {Buffer} output The buffer where to store the result
 * @param {Number} offset The offset at which to start writing
 * @param {Number} length The number of bytes to mask.
 * @public
 */
function _mask(source, mask, output, offset, length) {
  for (let i = 0; i < length; i++) {
    output[offset + i] = source[i] ^ mask[i & 3];
  }
}

/**
 * Unmasks a buffer using the given mask.
 *
 * @param {Buffer} buffer The buffer to unmask
 * @param {Buffer} mask The mask to use
 * @public
 */
function _unmask(buffer, mask) {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] ^= mask[i & 3];
  }
}

/**
 * Converts a buffer to an `ArrayBuffer`.
 *
 * @param {Buffer} buf The buffer to convert
 * @return {ArrayBuffer} Converted buffer
 * @public
 */
function toArrayBuffer$1(buf) {
  if (buf.length === buf.buffer.byteLength) {
    return buf.buffer;
  }

  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}

/**
 * Converts `data` to a `Buffer`.
 *
 * @param {*} data The data to convert
 * @return {Buffer} The buffer
 * @throws {TypeError}
 * @public
 */
function toBuffer$2(data) {
  toBuffer$2.readOnly = true;

  if (Buffer.isBuffer(data)) return data;

  let buf;

  if (data instanceof ArrayBuffer) {
    buf = new FastBuffer$2(data);
  } else if (ArrayBuffer.isView(data)) {
    buf = new FastBuffer$2(data.buffer, data.byteOffset, data.byteLength);
  } else {
    buf = Buffer.from(data);
    toBuffer$2.readOnly = false;
  }

  return buf;
}

bufferUtil$1.exports = {
  concat: concat$1,
  mask: _mask,
  toArrayBuffer: toArrayBuffer$1,
  toBuffer: toBuffer$2,
  unmask: _unmask
};

/* istanbul ignore else  */
if (!process.env.WS_NO_BUFFER_UTIL) {
  try {
    const bufferUtil = require('bufferutil');

    mask = bufferUtil$1.exports.mask = function (source, mask, output, offset, length) {
      if (length < 48) _mask(source, mask, output, offset, length);
      else bufferUtil.mask(source, mask, output, offset, length);
    };

    unmask$1 = bufferUtil$1.exports.unmask = function (buffer, mask) {
      if (buffer.length < 32) _unmask(buffer, mask);
      else bufferUtil.unmask(buffer, mask);
    };
  } catch (e) {
    // Continue regardless of the error.
  }
}

var bufferUtilExports = bufferUtil$1.exports;

const kDone = Symbol('kDone');
const kRun = Symbol('kRun');

/**
 * A very simple job queue with adjustable concurrency. Adapted from
 * https://github.com/STRML/async-limiter
 */
let Limiter$1 = class Limiter {
  /**
   * Creates a new `Limiter`.
   *
   * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
   *     to run concurrently
   */
  constructor(concurrency) {
    this[kDone] = () => {
      this.pending--;
      this[kRun]();
    };
    this.concurrency = concurrency || Infinity;
    this.jobs = [];
    this.pending = 0;
  }

  /**
   * Adds a job to the queue.
   *
   * @param {Function} job The job to run
   * @public
   */
  add(job) {
    this.jobs.push(job);
    this[kRun]();
  }

  /**
   * Removes a job from the queue and runs it if possible.
   *
   * @private
   */
  [kRun]() {
    if (this.pending === this.concurrency) return;

    if (this.jobs.length) {
      const job = this.jobs.shift();

      this.pending++;
      job(this[kDone]);
    }
  }
};

var limiter = Limiter$1;

const zlib = require$$0;

const bufferUtil = bufferUtilExports;
const Limiter = limiter;
const { kStatusCode: kStatusCode$2 } = constants;

const FastBuffer$1 = Buffer[Symbol.species];
const TRAILER = Buffer.from([0x00, 0x00, 0xff, 0xff]);
const kPerMessageDeflate = Symbol('permessage-deflate');
const kTotalLength = Symbol('total-length');
const kCallback = Symbol('callback');
const kBuffers = Symbol('buffers');
const kError$1 = Symbol('error');

//
// We limit zlib concurrency, which prevents severe memory fragmentation
// as documented in https://github.com/nodejs/node/issues/8871#issuecomment-250915913
// and https://github.com/websockets/ws/issues/1202
//
// Intentionally global; it's the global thread pool that's an issue.
//
let zlibLimiter;

/**
 * permessage-deflate implementation.
 */
let PerMessageDeflate$3 = class PerMessageDeflate {
  /**
   * Creates a PerMessageDeflate instance.
   *
   * @param {Object} [options] Configuration options
   * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
   *     for, or request, a custom client window size
   * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
   *     acknowledge disabling of client context takeover
   * @param {Number} [options.concurrencyLimit=10] The number of concurrent
   *     calls to zlib
   * @param {Boolean} [options.isServer=false] Create the instance in either
   *     server or client mode
   * @param {Number} [options.maxPayload=0] The maximum allowed message length
   * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
   *     use of a custom server window size
   * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
   *     disabling of server context takeover
   * @param {Number} [options.threshold=1024] Size (in bytes) below which
   *     messages should not be compressed if context takeover is disabled
   * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
   *     deflate
   * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
   *     inflate
   */
  constructor(options) {
    this._options = options || {};
    this._threshold =
      this._options.threshold !== undefined ? this._options.threshold : 1024;
    this._maxPayload = this._options.maxPayload | 0;
    this._isServer = !!this._options.isServer;
    this._deflate = null;
    this._inflate = null;

    this.params = null;

    if (!zlibLimiter) {
      const concurrency =
        this._options.concurrencyLimit !== undefined
          ? this._options.concurrencyLimit
          : 10;
      zlibLimiter = new Limiter(concurrency);
    }
  }

  /**
   * @type {String}
   */
  static get extensionName() {
    return 'permessage-deflate';
  }

  /**
   * Create an extension negotiation offer.
   *
   * @return {Object} Extension parameters
   * @public
   */
  offer() {
    const params = {};

    if (this._options.serverNoContextTakeover) {
      params.server_no_context_takeover = true;
    }
    if (this._options.clientNoContextTakeover) {
      params.client_no_context_takeover = true;
    }
    if (this._options.serverMaxWindowBits) {
      params.server_max_window_bits = this._options.serverMaxWindowBits;
    }
    if (this._options.clientMaxWindowBits) {
      params.client_max_window_bits = this._options.clientMaxWindowBits;
    } else if (this._options.clientMaxWindowBits == null) {
      params.client_max_window_bits = true;
    }

    return params;
  }

  /**
   * Accept an extension negotiation offer/response.
   *
   * @param {Array} configurations The extension negotiation offers/reponse
   * @return {Object} Accepted configuration
   * @public
   */
  accept(configurations) {
    configurations = this.normalizeParams(configurations);

    this.params = this._isServer
      ? this.acceptAsServer(configurations)
      : this.acceptAsClient(configurations);

    return this.params;
  }

  /**
   * Releases all resources used by the extension.
   *
   * @public
   */
  cleanup() {
    if (this._inflate) {
      this._inflate.close();
      this._inflate = null;
    }

    if (this._deflate) {
      const callback = this._deflate[kCallback];

      this._deflate.close();
      this._deflate = null;

      if (callback) {
        callback(
          new Error(
            'The deflate stream was closed while data was being processed'
          )
        );
      }
    }
  }

  /**
   *  Accept an extension negotiation offer.
   *
   * @param {Array} offers The extension negotiation offers
   * @return {Object} Accepted configuration
   * @private
   */
  acceptAsServer(offers) {
    const opts = this._options;
    const accepted = offers.find((params) => {
      if (
        (opts.serverNoContextTakeover === false &&
          params.server_no_context_takeover) ||
        (params.server_max_window_bits &&
          (opts.serverMaxWindowBits === false ||
            (typeof opts.serverMaxWindowBits === 'number' &&
              opts.serverMaxWindowBits > params.server_max_window_bits))) ||
        (typeof opts.clientMaxWindowBits === 'number' &&
          !params.client_max_window_bits)
      ) {
        return false;
      }

      return true;
    });

    if (!accepted) {
      throw new Error('None of the extension offers can be accepted');
    }

    if (opts.serverNoContextTakeover) {
      accepted.server_no_context_takeover = true;
    }
    if (opts.clientNoContextTakeover) {
      accepted.client_no_context_takeover = true;
    }
    if (typeof opts.serverMaxWindowBits === 'number') {
      accepted.server_max_window_bits = opts.serverMaxWindowBits;
    }
    if (typeof opts.clientMaxWindowBits === 'number') {
      accepted.client_max_window_bits = opts.clientMaxWindowBits;
    } else if (
      accepted.client_max_window_bits === true ||
      opts.clientMaxWindowBits === false
    ) {
      delete accepted.client_max_window_bits;
    }

    return accepted;
  }

  /**
   * Accept the extension negotiation response.
   *
   * @param {Array} response The extension negotiation response
   * @return {Object} Accepted configuration
   * @private
   */
  acceptAsClient(response) {
    const params = response[0];

    if (
      this._options.clientNoContextTakeover === false &&
      params.client_no_context_takeover
    ) {
      throw new Error('Unexpected parameter "client_no_context_takeover"');
    }

    if (!params.client_max_window_bits) {
      if (typeof this._options.clientMaxWindowBits === 'number') {
        params.client_max_window_bits = this._options.clientMaxWindowBits;
      }
    } else if (
      this._options.clientMaxWindowBits === false ||
      (typeof this._options.clientMaxWindowBits === 'number' &&
        params.client_max_window_bits > this._options.clientMaxWindowBits)
    ) {
      throw new Error(
        'Unexpected or invalid parameter "client_max_window_bits"'
      );
    }

    return params;
  }

  /**
   * Normalize parameters.
   *
   * @param {Array} configurations The extension negotiation offers/reponse
   * @return {Array} The offers/response with normalized parameters
   * @private
   */
  normalizeParams(configurations) {
    configurations.forEach((params) => {
      Object.keys(params).forEach((key) => {
        let value = params[key];

        if (value.length > 1) {
          throw new Error(`Parameter "${key}" must have only a single value`);
        }

        value = value[0];

        if (key === 'client_max_window_bits') {
          if (value !== true) {
            const num = +value;
            if (!Number.isInteger(num) || num < 8 || num > 15) {
              throw new TypeError(
                `Invalid value for parameter "${key}": ${value}`
              );
            }
            value = num;
          } else if (!this._isServer) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
        } else if (key === 'server_max_window_bits') {
          const num = +value;
          if (!Number.isInteger(num) || num < 8 || num > 15) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
          value = num;
        } else if (
          key === 'client_no_context_takeover' ||
          key === 'server_no_context_takeover'
        ) {
          if (value !== true) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
        } else {
          throw new Error(`Unknown parameter "${key}"`);
        }

        params[key] = value;
      });
    });

    return configurations;
  }

  /**
   * Decompress data. Concurrency limited.
   *
   * @param {Buffer} data Compressed data
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @public
   */
  decompress(data, fin, callback) {
    zlibLimiter.add((done) => {
      this._decompress(data, fin, (err, result) => {
        done();
        callback(err, result);
      });
    });
  }

  /**
   * Compress data. Concurrency limited.
   *
   * @param {(Buffer|String)} data Data to compress
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @public
   */
  compress(data, fin, callback) {
    zlibLimiter.add((done) => {
      this._compress(data, fin, (err, result) => {
        done();
        callback(err, result);
      });
    });
  }

  /**
   * Decompress data.
   *
   * @param {Buffer} data Compressed data
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @private
   */
  _decompress(data, fin, callback) {
    const endpoint = this._isServer ? 'client' : 'server';

    if (!this._inflate) {
      const key = `${endpoint}_max_window_bits`;
      const windowBits =
        typeof this.params[key] !== 'number'
          ? zlib.Z_DEFAULT_WINDOWBITS
          : this.params[key];

      this._inflate = zlib.createInflateRaw({
        ...this._options.zlibInflateOptions,
        windowBits
      });
      this._inflate[kPerMessageDeflate] = this;
      this._inflate[kTotalLength] = 0;
      this._inflate[kBuffers] = [];
      this._inflate.on('error', inflateOnError);
      this._inflate.on('data', inflateOnData);
    }

    this._inflate[kCallback] = callback;

    this._inflate.write(data);
    if (fin) this._inflate.write(TRAILER);

    this._inflate.flush(() => {
      const err = this._inflate[kError$1];

      if (err) {
        this._inflate.close();
        this._inflate = null;
        callback(err);
        return;
      }

      const data = bufferUtil.concat(
        this._inflate[kBuffers],
        this._inflate[kTotalLength]
      );

      if (this._inflate._readableState.endEmitted) {
        this._inflate.close();
        this._inflate = null;
      } else {
        this._inflate[kTotalLength] = 0;
        this._inflate[kBuffers] = [];

        if (fin && this.params[`${endpoint}_no_context_takeover`]) {
          this._inflate.reset();
        }
      }

      callback(null, data);
    });
  }

  /**
   * Compress data.
   *
   * @param {(Buffer|String)} data Data to compress
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @private
   */
  _compress(data, fin, callback) {
    const endpoint = this._isServer ? 'server' : 'client';

    if (!this._deflate) {
      const key = `${endpoint}_max_window_bits`;
      const windowBits =
        typeof this.params[key] !== 'number'
          ? zlib.Z_DEFAULT_WINDOWBITS
          : this.params[key];

      this._deflate = zlib.createDeflateRaw({
        ...this._options.zlibDeflateOptions,
        windowBits
      });

      this._deflate[kTotalLength] = 0;
      this._deflate[kBuffers] = [];

      this._deflate.on('data', deflateOnData);
    }

    this._deflate[kCallback] = callback;

    this._deflate.write(data);
    this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
      if (!this._deflate) {
        //
        // The deflate stream was closed while data was being processed.
        //
        return;
      }

      let data = bufferUtil.concat(
        this._deflate[kBuffers],
        this._deflate[kTotalLength]
      );

      if (fin) {
        data = new FastBuffer$1(data.buffer, data.byteOffset, data.length - 4);
      }

      //
      // Ensure that the callback will not be called again in
      // `PerMessageDeflate#cleanup()`.
      //
      this._deflate[kCallback] = null;

      this._deflate[kTotalLength] = 0;
      this._deflate[kBuffers] = [];

      if (fin && this.params[`${endpoint}_no_context_takeover`]) {
        this._deflate.reset();
      }

      callback(null, data);
    });
  }
};

var permessageDeflate = PerMessageDeflate$3;

/**
 * The listener of the `zlib.DeflateRaw` stream `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function deflateOnData(chunk) {
  this[kBuffers].push(chunk);
  this[kTotalLength] += chunk.length;
}

/**
 * The listener of the `zlib.InflateRaw` stream `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function inflateOnData(chunk) {
  this[kTotalLength] += chunk.length;

  if (
    this[kPerMessageDeflate]._maxPayload < 1 ||
    this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload
  ) {
    this[kBuffers].push(chunk);
    return;
  }

  this[kError$1] = new RangeError('Max payload size exceeded');
  this[kError$1].code = 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH';
  this[kError$1][kStatusCode$2] = 1009;
  this.removeListener('data', inflateOnData);

  //
  // The choice to employ `zlib.reset()` over `zlib.close()` is dictated by the
  // fact that in Node.js versions prior to 13.10.0, the callback for
  // `zlib.flush()` is not called if `zlib.close()` is used. Utilizing
  // `zlib.reset()` ensures that either the callback is invoked or an error is
  // emitted.
  //
  this.reset();
}

/**
 * The listener of the `zlib.InflateRaw` stream `'error'` event.
 *
 * @param {Error} err The emitted error
 * @private
 */
function inflateOnError(err) {
  //
  // There is no need to call `Zlib#close()` as the handle is automatically
  // closed when an error is emitted.
  //
  this[kPerMessageDeflate]._inflate = null;

  if (this[kError$1]) {
    this[kCallback](this[kError$1]);
    return;
  }

  err[kStatusCode$2] = 1007;
  this[kCallback](err);
}

var validation = {exports: {}};

var isValidUTF8_1;

const { isUtf8 } = require$$0$1;

const { hasBlob } = constants;

//
// Allowed token characters:
//
// '!', '#', '$', '%', '&', ''', '*', '+', '-',
// '.', 0-9, A-Z, '^', '_', '`', a-z, '|', '~'
//
// tokenChars[32] === 0 // ' '
// tokenChars[33] === 1 // '!'
// tokenChars[34] === 0 // '"'
// ...
//
// prettier-ignore
const tokenChars$2 = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0 - 15
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16 - 31
  0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, // 32 - 47
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, // 48 - 63
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 64 - 79
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, // 80 - 95
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 96 - 111
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0 // 112 - 127
];

/**
 * Checks if a status code is allowed in a close frame.
 *
 * @param {Number} code The status code
 * @return {Boolean} `true` if the status code is valid, else `false`
 * @public
 */
function isValidStatusCode$2(code) {
  return (
    (code >= 1000 &&
      code <= 1014 &&
      code !== 1004 &&
      code !== 1005 &&
      code !== 1006) ||
    (code >= 3000 && code <= 4999)
  );
}

/**
 * Checks if a given buffer contains only correct UTF-8.
 * Ported from https://www.cl.cam.ac.uk/%7Emgk25/ucs/utf8_check.c by
 * Markus Kuhn.
 *
 * @param {Buffer} buf The buffer to check
 * @return {Boolean} `true` if `buf` contains only correct UTF-8, else `false`
 * @public
 */
function _isValidUTF8(buf) {
  const len = buf.length;
  let i = 0;

  while (i < len) {
    if ((buf[i] & 0x80) === 0) {
      // 0xxxxxxx
      i++;
    } else if ((buf[i] & 0xe0) === 0xc0) {
      // 110xxxxx 10xxxxxx
      if (
        i + 1 === len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i] & 0xfe) === 0xc0 // Overlong
      ) {
        return false;
      }

      i += 2;
    } else if ((buf[i] & 0xf0) === 0xe0) {
      // 1110xxxx 10xxxxxx 10xxxxxx
      if (
        i + 2 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i] === 0xe0 && (buf[i + 1] & 0xe0) === 0x80) || // Overlong
        (buf[i] === 0xed && (buf[i + 1] & 0xe0) === 0xa0) // Surrogate (U+D800 - U+DFFF)
      ) {
        return false;
      }

      i += 3;
    } else if ((buf[i] & 0xf8) === 0xf0) {
      // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      if (
        i + 3 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i + 3] & 0xc0) !== 0x80 ||
        (buf[i] === 0xf0 && (buf[i + 1] & 0xf0) === 0x80) || // Overlong
        (buf[i] === 0xf4 && buf[i + 1] > 0x8f) ||
        buf[i] > 0xf4 // > U+10FFFF
      ) {
        return false;
      }

      i += 4;
    } else {
      return false;
    }
  }

  return true;
}

/**
 * Determines whether a value is a `Blob`.
 *
 * @param {*} value The value to be tested
 * @return {Boolean} `true` if `value` is a `Blob`, else `false`
 * @private
 */
function isBlob$2(value) {
  return (
    hasBlob &&
    typeof value === 'object' &&
    typeof value.arrayBuffer === 'function' &&
    typeof value.type === 'string' &&
    typeof value.stream === 'function' &&
    (value[Symbol.toStringTag] === 'Blob' ||
      value[Symbol.toStringTag] === 'File')
  );
}

validation.exports = {
  isBlob: isBlob$2,
  isValidStatusCode: isValidStatusCode$2,
  isValidUTF8: _isValidUTF8,
  tokenChars: tokenChars$2
};

if (isUtf8) {
  isValidUTF8_1 = validation.exports.isValidUTF8 = function (buf) {
    return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
  };
} /* istanbul ignore else  */ else if (!process.env.WS_NO_UTF_8_VALIDATE) {
  try {
    const isValidUTF8 = require('utf-8-validate');

    isValidUTF8_1 = validation.exports.isValidUTF8 = function (buf) {
      return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
    };
  } catch (e) {
    // Continue regardless of the error.
  }
}

var validationExports = validation.exports;

const { Writable } = require$$0$2;

const PerMessageDeflate$2 = permessageDeflate;
const {
  BINARY_TYPES: BINARY_TYPES$1,
  EMPTY_BUFFER: EMPTY_BUFFER$2,
  kStatusCode: kStatusCode$1,
  kWebSocket: kWebSocket$3
} = constants;
const { concat, toArrayBuffer, unmask } = bufferUtilExports;
const { isValidStatusCode: isValidStatusCode$1, isValidUTF8 } = validationExports;

const FastBuffer = Buffer[Symbol.species];

const GET_INFO = 0;
const GET_PAYLOAD_LENGTH_16 = 1;
const GET_PAYLOAD_LENGTH_64 = 2;
const GET_MASK = 3;
const GET_DATA = 4;
const INFLATING = 5;
const DEFER_EVENT = 6;

/**
 * HyBi Receiver implementation.
 *
 * @extends Writable
 */
let Receiver$1 = class Receiver extends Writable {
  /**
   * Creates a Receiver instance.
   *
   * @param {Object} [options] Options object
   * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
   *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
   *     multiple times in the same tick
   * @param {String} [options.binaryType=nodebuffer] The type for binary data
   * @param {Object} [options.extensions] An object containing the negotiated
   *     extensions
   * @param {Boolean} [options.isServer=false] Specifies whether to operate in
   *     client or server mode
   * @param {Number} [options.maxBufferedChunks=0] The maximum number of
   *     buffered data chunks
   * @param {Number} [options.maxFragments=0] The maximum number of message
   *     fragments
   * @param {Number} [options.maxPayload=0] The maximum allowed message length
   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
   *     not to skip UTF-8 validation for text and close messages
   */
  constructor(options = {}) {
    super();

    this._allowSynchronousEvents =
      options.allowSynchronousEvents !== undefined
        ? options.allowSynchronousEvents
        : true;
    this._binaryType = options.binaryType || BINARY_TYPES$1[0];
    this._extensions = options.extensions || {};
    this._isServer = !!options.isServer;
    this._maxBufferedChunks = options.maxBufferedChunks | 0;
    this._maxFragments = options.maxFragments | 0;
    this._maxPayload = options.maxPayload | 0;
    this._skipUTF8Validation = !!options.skipUTF8Validation;
    this[kWebSocket$3] = undefined;

    this._bufferedBytes = 0;
    this._buffers = [];

    this._compressed = false;
    this._payloadLength = 0;
    this._mask = undefined;
    this._fragmented = 0;
    this._masked = false;
    this._fin = false;
    this._opcode = 0;

    this._totalPayloadLength = 0;
    this._messageLength = 0;
    this._fragments = [];

    this._errored = false;
    this._loop = false;
    this._state = GET_INFO;
  }

  /**
   * Implements `Writable.prototype._write()`.
   *
   * @param {Buffer} chunk The chunk of data to write
   * @param {String} encoding The character encoding of `chunk`
   * @param {Function} cb Callback
   * @private
   */
  _write(chunk, encoding, cb) {
    if (this._opcode === 0x08 && this._state == GET_INFO) return cb();

    if (
      this._maxBufferedChunks > 0 &&
      this._buffers.length >= this._maxBufferedChunks
    ) {
      cb(
        this.createError(
          RangeError,
          'Too many buffered chunks',
          false,
          1008,
          'WS_ERR_TOO_MANY_BUFFERED_PARTS'
        )
      );
      return;
    }

    this._bufferedBytes += chunk.length;
    this._buffers.push(chunk);
    this.startLoop(cb);
  }

  /**
   * Consumes `n` bytes from the buffered data.
   *
   * @param {Number} n The number of bytes to consume
   * @return {Buffer} The consumed bytes
   * @private
   */
  consume(n) {
    this._bufferedBytes -= n;

    if (n === this._buffers[0].length) return this._buffers.shift();

    if (n < this._buffers[0].length) {
      const buf = this._buffers[0];
      this._buffers[0] = new FastBuffer(
        buf.buffer,
        buf.byteOffset + n,
        buf.length - n
      );

      return new FastBuffer(buf.buffer, buf.byteOffset, n);
    }

    const dst = Buffer.allocUnsafe(n);

    do {
      const buf = this._buffers[0];
      const offset = dst.length - n;

      if (n >= buf.length) {
        dst.set(this._buffers.shift(), offset);
      } else {
        dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
        this._buffers[0] = new FastBuffer(
          buf.buffer,
          buf.byteOffset + n,
          buf.length - n
        );
      }

      n -= buf.length;
    } while (n > 0);

    return dst;
  }

  /**
   * Starts the parsing loop.
   *
   * @param {Function} cb Callback
   * @private
   */
  startLoop(cb) {
    this._loop = true;

    do {
      switch (this._state) {
        case GET_INFO:
          this.getInfo(cb);
          break;
        case GET_PAYLOAD_LENGTH_16:
          this.getPayloadLength16(cb);
          break;
        case GET_PAYLOAD_LENGTH_64:
          this.getPayloadLength64(cb);
          break;
        case GET_MASK:
          this.getMask();
          break;
        case GET_DATA:
          this.getData(cb);
          break;
        case INFLATING:
        case DEFER_EVENT:
          this._loop = false;
          return;
      }
    } while (this._loop);

    if (!this._errored) cb();
  }

  /**
   * Reads the first two bytes of a frame.
   *
   * @param {Function} cb Callback
   * @private
   */
  getInfo(cb) {
    if (this._bufferedBytes < 2) {
      this._loop = false;
      return;
    }

    const buf = this.consume(2);

    if ((buf[0] & 0x30) !== 0x00) {
      const error = this.createError(
        RangeError,
        'RSV2 and RSV3 must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_RSV_2_3'
      );

      cb(error);
      return;
    }

    const compressed = (buf[0] & 0x40) === 0x40;

    if (compressed && !this._extensions[PerMessageDeflate$2.extensionName]) {
      const error = this.createError(
        RangeError,
        'RSV1 must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_RSV_1'
      );

      cb(error);
      return;
    }

    this._fin = (buf[0] & 0x80) === 0x80;
    this._opcode = buf[0] & 0x0f;
    this._payloadLength = buf[1] & 0x7f;

    if (this._opcode === 0x00) {
      if (compressed) {
        const error = this.createError(
          RangeError,
          'RSV1 must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_RSV_1'
        );

        cb(error);
        return;
      }

      if (!this._fragmented) {
        const error = this.createError(
          RangeError,
          'invalid opcode 0',
          true,
          1002,
          'WS_ERR_INVALID_OPCODE'
        );

        cb(error);
        return;
      }

      this._opcode = this._fragmented;
    } else if (this._opcode === 0x01 || this._opcode === 0x02) {
      if (this._fragmented) {
        const error = this.createError(
          RangeError,
          `invalid opcode ${this._opcode}`,
          true,
          1002,
          'WS_ERR_INVALID_OPCODE'
        );

        cb(error);
        return;
      }

      this._compressed = compressed;
    } else if (this._opcode > 0x07 && this._opcode < 0x0b) {
      if (!this._fin) {
        const error = this.createError(
          RangeError,
          'FIN must be set',
          true,
          1002,
          'WS_ERR_EXPECTED_FIN'
        );

        cb(error);
        return;
      }

      if (compressed) {
        const error = this.createError(
          RangeError,
          'RSV1 must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_RSV_1'
        );

        cb(error);
        return;
      }

      if (
        this._payloadLength > 0x7d ||
        (this._opcode === 0x08 && this._payloadLength === 1)
      ) {
        const error = this.createError(
          RangeError,
          `invalid payload length ${this._payloadLength}`,
          true,
          1002,
          'WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH'
        );

        cb(error);
        return;
      }
    } else {
      const error = this.createError(
        RangeError,
        `invalid opcode ${this._opcode}`,
        true,
        1002,
        'WS_ERR_INVALID_OPCODE'
      );

      cb(error);
      return;
    }

    if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
    this._masked = (buf[1] & 0x80) === 0x80;

    if (this._isServer) {
      if (!this._masked) {
        const error = this.createError(
          RangeError,
          'MASK must be set',
          true,
          1002,
          'WS_ERR_EXPECTED_MASK'
        );

        cb(error);
        return;
      }
    } else if (this._masked) {
      const error = this.createError(
        RangeError,
        'MASK must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_MASK'
      );

      cb(error);
      return;
    }

    if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
    else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
    else this.haveLength(cb);
  }

  /**
   * Gets extended payload length (7+16).
   *
   * @param {Function} cb Callback
   * @private
   */
  getPayloadLength16(cb) {
    if (this._bufferedBytes < 2) {
      this._loop = false;
      return;
    }

    this._payloadLength = this.consume(2).readUInt16BE(0);
    this.haveLength(cb);
  }

  /**
   * Gets extended payload length (7+64).
   *
   * @param {Function} cb Callback
   * @private
   */
  getPayloadLength64(cb) {
    if (this._bufferedBytes < 8) {
      this._loop = false;
      return;
    }

    const buf = this.consume(8);
    const num = buf.readUInt32BE(0);

    //
    // The maximum safe integer in JavaScript is 2^53 - 1. An error is returned
    // if payload length is greater than this number.
    //
    if (num > Math.pow(2, 53 - 32) - 1) {
      const error = this.createError(
        RangeError,
        'Unsupported WebSocket frame: payload length > 2^53 - 1',
        false,
        1009,
        'WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH'
      );

      cb(error);
      return;
    }

    this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
    this.haveLength(cb);
  }

  /**
   * Payload length has been read.
   *
   * @param {Function} cb Callback
   * @private
   */
  haveLength(cb) {
    if (this._payloadLength && this._opcode < 0x08) {
      this._totalPayloadLength += this._payloadLength;
      if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
        const error = this.createError(
          RangeError,
          'Max payload size exceeded',
          false,
          1009,
          'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
        );

        cb(error);
        return;
      }
    }

    if (this._masked) this._state = GET_MASK;
    else this._state = GET_DATA;
  }

  /**
   * Reads mask bytes.
   *
   * @private
   */
  getMask() {
    if (this._bufferedBytes < 4) {
      this._loop = false;
      return;
    }

    this._mask = this.consume(4);
    this._state = GET_DATA;
  }

  /**
   * Reads data bytes.
   *
   * @param {Function} cb Callback
   * @private
   */
  getData(cb) {
    let data = EMPTY_BUFFER$2;

    if (this._payloadLength) {
      if (this._bufferedBytes < this._payloadLength) {
        this._loop = false;
        return;
      }

      data = this.consume(this._payloadLength);

      if (
        this._masked &&
        (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0
      ) {
        unmask(data, this._mask);
      }
    }

    if (this._opcode > 0x07) {
      this.controlMessage(data, cb);
      return;
    }

    if (this._compressed) {
      this._state = INFLATING;
      this.decompress(data, cb);
      return;
    }

    if (data.length) {
      if (
        this._maxFragments > 0 &&
        this._fragments.length >= this._maxFragments
      ) {
        const error = this.createError(
          RangeError,
          'Too many message fragments',
          false,
          1008,
          'WS_ERR_TOO_MANY_BUFFERED_PARTS'
        );

        cb(error);
        return;
      }

      //
      // This message is not compressed so its length is the sum of the payload
      // length of all fragments.
      //
      this._messageLength = this._totalPayloadLength;
      this._fragments.push(data);
    }

    this.dataMessage(cb);
  }

  /**
   * Decompresses data.
   *
   * @param {Buffer} data Compressed data
   * @param {Function} cb Callback
   * @private
   */
  decompress(data, cb) {
    const perMessageDeflate = this._extensions[PerMessageDeflate$2.extensionName];

    perMessageDeflate.decompress(data, this._fin, (err, buf) => {
      if (err) return cb(err);

      if (buf.length) {
        this._messageLength += buf.length;
        if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
          const error = this.createError(
            RangeError,
            'Max payload size exceeded',
            false,
            1009,
            'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
          );

          cb(error);
          return;
        }

        if (
          this._maxFragments > 0 &&
          this._fragments.length >= this._maxFragments
        ) {
          const error = this.createError(
            RangeError,
            'Too many message fragments',
            false,
            1008,
            'WS_ERR_TOO_MANY_BUFFERED_PARTS'
          );

          cb(error);
          return;
        }

        this._fragments.push(buf);
      }

      this.dataMessage(cb);
      if (this._state === GET_INFO) this.startLoop(cb);
    });
  }

  /**
   * Handles a data message.
   *
   * @param {Function} cb Callback
   * @private
   */
  dataMessage(cb) {
    if (!this._fin) {
      this._state = GET_INFO;
      return;
    }

    const messageLength = this._messageLength;
    const fragments = this._fragments;

    this._totalPayloadLength = 0;
    this._messageLength = 0;
    this._fragmented = 0;
    this._fragments = [];

    if (this._opcode === 2) {
      let data;

      if (this._binaryType === 'nodebuffer') {
        data = concat(fragments, messageLength);
      } else if (this._binaryType === 'arraybuffer') {
        data = toArrayBuffer(concat(fragments, messageLength));
      } else if (this._binaryType === 'blob') {
        data = new Blob(fragments);
      } else {
        data = fragments;
      }

      if (this._allowSynchronousEvents) {
        this.emit('message', data, true);
        this._state = GET_INFO;
      } else {
        this._state = DEFER_EVENT;
        setImmediate(() => {
          this.emit('message', data, true);
          this._state = GET_INFO;
          this.startLoop(cb);
        });
      }
    } else {
      const buf = concat(fragments, messageLength);

      if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
        const error = this.createError(
          Error,
          'invalid UTF-8 sequence',
          true,
          1007,
          'WS_ERR_INVALID_UTF8'
        );

        cb(error);
        return;
      }

      if (this._state === INFLATING || this._allowSynchronousEvents) {
        this.emit('message', buf, false);
        this._state = GET_INFO;
      } else {
        this._state = DEFER_EVENT;
        setImmediate(() => {
          this.emit('message', buf, false);
          this._state = GET_INFO;
          this.startLoop(cb);
        });
      }
    }
  }

  /**
   * Handles a control message.
   *
   * @param {Buffer} data Data to handle
   * @return {(Error|RangeError|undefined)} A possible error
   * @private
   */
  controlMessage(data, cb) {
    if (this._opcode === 0x08) {
      if (data.length === 0) {
        this._loop = false;
        this.emit('conclude', 1005, EMPTY_BUFFER$2);
        this.end();
      } else {
        const code = data.readUInt16BE(0);

        if (!isValidStatusCode$1(code)) {
          const error = this.createError(
            RangeError,
            `invalid status code ${code}`,
            true,
            1002,
            'WS_ERR_INVALID_CLOSE_CODE'
          );

          cb(error);
          return;
        }

        const buf = new FastBuffer(
          data.buffer,
          data.byteOffset + 2,
          data.length - 2
        );

        if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
          const error = this.createError(
            Error,
            'invalid UTF-8 sequence',
            true,
            1007,
            'WS_ERR_INVALID_UTF8'
          );

          cb(error);
          return;
        }

        this._loop = false;
        this.emit('conclude', code, buf);
        this.end();
      }

      this._state = GET_INFO;
      return;
    }

    if (this._allowSynchronousEvents) {
      this.emit(this._opcode === 0x09 ? 'ping' : 'pong', data);
      this._state = GET_INFO;
    } else {
      this._state = DEFER_EVENT;
      setImmediate(() => {
        this.emit(this._opcode === 0x09 ? 'ping' : 'pong', data);
        this._state = GET_INFO;
        this.startLoop(cb);
      });
    }
  }

  /**
   * Builds an error object.
   *
   * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
   * @param {String} message The error message
   * @param {Boolean} prefix Specifies whether or not to add a default prefix to
   *     `message`
   * @param {Number} statusCode The status code
   * @param {String} errorCode The exposed error code
   * @return {(Error|RangeError)} The error
   * @private
   */
  createError(ErrorCtor, message, prefix, statusCode, errorCode) {
    this._loop = false;
    this._errored = true;

    const err = new ErrorCtor(
      prefix ? `Invalid WebSocket frame: ${message}` : message
    );

    Error.captureStackTrace(err, this.createError);
    err.code = errorCode;
    err[kStatusCode$1] = statusCode;
    return err;
  }
};

var receiver = Receiver$1;

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex" }] */

const { Duplex: Duplex$3 } = require$$0$2;
const { randomFillSync } = require$$1;
const {
  types: { isUint8Array }
} = require$$2;

const PerMessageDeflate$1 = permessageDeflate;
const { EMPTY_BUFFER: EMPTY_BUFFER$1, kWebSocket: kWebSocket$2, NOOP: NOOP$1 } = constants;
const { isBlob: isBlob$1, isValidStatusCode } = validationExports;
const { mask: applyMask, toBuffer: toBuffer$1 } = bufferUtilExports;

const kByteLength = Symbol('kByteLength');
const maskBuffer = Buffer.alloc(4);
const RANDOM_POOL_SIZE = 8 * 1024;
let randomPool;
let randomPoolPointer = RANDOM_POOL_SIZE;

const DEFAULT = 0;
const DEFLATING = 1;
const GET_BLOB_DATA = 2;

/**
 * HyBi Sender implementation.
 */
let Sender$1 = class Sender {
  /**
   * Creates a Sender instance.
   *
   * @param {Duplex} socket The connection socket
   * @param {Object} [extensions] An object containing the negotiated extensions
   * @param {Function} [generateMask] The function used to generate the masking
   *     key
   */
  constructor(socket, extensions, generateMask) {
    this._extensions = extensions || {};

    if (generateMask) {
      this._generateMask = generateMask;
      this._maskBuffer = Buffer.alloc(4);
    }

    this._socket = socket;

    this._firstFragment = true;
    this._compress = false;

    this._bufferedBytes = 0;
    this._queue = [];
    this._state = DEFAULT;
    this.onerror = NOOP$1;
    this[kWebSocket$2] = undefined;
  }

  /**
   * Frames a piece of data according to the HyBi WebSocket protocol.
   *
   * @param {(Buffer|String)} data The data to frame
   * @param {Object} options Options object
   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
   *     FIN bit
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
   *     key
   * @param {Number} options.opcode The opcode
   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
   *     modified
   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
   *     RSV1 bit
   * @return {(Buffer|String)[]} The framed data
   * @public
   */
  static frame(data, options) {
    let mask;
    let merge = false;
    let offset = 2;
    let skipMasking = false;

    if (options.mask) {
      mask = options.maskBuffer || maskBuffer;

      if (options.generateMask) {
        options.generateMask(mask);
      } else {
        if (randomPoolPointer === RANDOM_POOL_SIZE) {
          /* istanbul ignore else  */
          if (randomPool === undefined) {
            //
            // This is lazily initialized because server-sent frames must not
            // be masked so it may never be used.
            //
            randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
          }

          randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
          randomPoolPointer = 0;
        }

        mask[0] = randomPool[randomPoolPointer++];
        mask[1] = randomPool[randomPoolPointer++];
        mask[2] = randomPool[randomPoolPointer++];
        mask[3] = randomPool[randomPoolPointer++];
      }

      skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
      offset = 6;
    }

    let dataLength;

    if (typeof data === 'string') {
      if (
        (!options.mask || skipMasking) &&
        options[kByteLength] !== undefined
      ) {
        dataLength = options[kByteLength];
      } else {
        data = Buffer.from(data);
        dataLength = data.length;
      }
    } else {
      dataLength = data.length;
      merge = options.mask && options.readOnly && !skipMasking;
    }

    let payloadLength = dataLength;

    if (dataLength >= 65536) {
      offset += 8;
      payloadLength = 127;
    } else if (dataLength > 125) {
      offset += 2;
      payloadLength = 126;
    }

    const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);

    target[0] = options.fin ? options.opcode | 0x80 : options.opcode;
    if (options.rsv1) target[0] |= 0x40;

    target[1] = payloadLength;

    if (payloadLength === 126) {
      target.writeUInt16BE(dataLength, 2);
    } else if (payloadLength === 127) {
      target[2] = target[3] = 0;
      target.writeUIntBE(dataLength, 4, 6);
    }

    if (!options.mask) return [target, data];

    target[1] |= 0x80;
    target[offset - 4] = mask[0];
    target[offset - 3] = mask[1];
    target[offset - 2] = mask[2];
    target[offset - 1] = mask[3];

    if (skipMasking) return [target, data];

    if (merge) {
      applyMask(data, mask, target, offset, dataLength);
      return [target];
    }

    applyMask(data, mask, data, 0, dataLength);
    return [target, data];
  }

  /**
   * Sends a close message to the other peer.
   *
   * @param {Number} [code] The status code component of the body
   * @param {(String|Buffer)} [data] The message component of the body
   * @param {Boolean} [mask=false] Specifies whether or not to mask the message
   * @param {Function} [cb] Callback
   * @public
   */
  close(code, data, mask, cb) {
    let buf;

    if (code === undefined) {
      buf = EMPTY_BUFFER$1;
    } else if (typeof code !== 'number' || !isValidStatusCode(code)) {
      throw new TypeError('First argument must be a valid error code number');
    } else if (data === undefined || !data.length) {
      buf = Buffer.allocUnsafe(2);
      buf.writeUInt16BE(code, 0);
    } else {
      const length = Buffer.byteLength(data);

      if (length > 123) {
        throw new RangeError('The message must not be greater than 123 bytes');
      }

      buf = Buffer.allocUnsafe(2 + length);
      buf.writeUInt16BE(code, 0);

      if (typeof data === 'string') {
        buf.write(data, 2);
      } else if (isUint8Array(data)) {
        buf.set(data, 2);
      } else {
        throw new TypeError('Second argument must be a string or a Uint8Array');
      }
    }

    const options = {
      [kByteLength]: buf.length,
      fin: true,
      generateMask: this._generateMask,
      mask,
      maskBuffer: this._maskBuffer,
      opcode: 0x08,
      readOnly: false,
      rsv1: false
    };

    if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, buf, false, options, cb]);
    } else {
      this.sendFrame(Sender.frame(buf, options), cb);
    }
  }

  /**
   * Sends a ping message to the other peer.
   *
   * @param {*} data The message to send
   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback
   * @public
   */
  ping(data, mask, cb) {
    let byteLength;
    let readOnly;

    if (typeof data === 'string') {
      byteLength = Buffer.byteLength(data);
      readOnly = false;
    } else if (isBlob$1(data)) {
      byteLength = data.size;
      readOnly = false;
    } else {
      data = toBuffer$1(data);
      byteLength = data.length;
      readOnly = toBuffer$1.readOnly;
    }

    if (byteLength > 125) {
      throw new RangeError('The data size must not be greater than 125 bytes');
    }

    const options = {
      [kByteLength]: byteLength,
      fin: true,
      generateMask: this._generateMask,
      mask,
      maskBuffer: this._maskBuffer,
      opcode: 0x09,
      readOnly,
      rsv1: false
    };

    if (isBlob$1(data)) {
      if (this._state !== DEFAULT) {
        this.enqueue([this.getBlobData, data, false, options, cb]);
      } else {
        this.getBlobData(data, false, options, cb);
      }
    } else if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, data, false, options, cb]);
    } else {
      this.sendFrame(Sender.frame(data, options), cb);
    }
  }

  /**
   * Sends a pong message to the other peer.
   *
   * @param {*} data The message to send
   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback
   * @public
   */
  pong(data, mask, cb) {
    let byteLength;
    let readOnly;

    if (typeof data === 'string') {
      byteLength = Buffer.byteLength(data);
      readOnly = false;
    } else if (isBlob$1(data)) {
      byteLength = data.size;
      readOnly = false;
    } else {
      data = toBuffer$1(data);
      byteLength = data.length;
      readOnly = toBuffer$1.readOnly;
    }

    if (byteLength > 125) {
      throw new RangeError('The data size must not be greater than 125 bytes');
    }

    const options = {
      [kByteLength]: byteLength,
      fin: true,
      generateMask: this._generateMask,
      mask,
      maskBuffer: this._maskBuffer,
      opcode: 0x0a,
      readOnly,
      rsv1: false
    };

    if (isBlob$1(data)) {
      if (this._state !== DEFAULT) {
        this.enqueue([this.getBlobData, data, false, options, cb]);
      } else {
        this.getBlobData(data, false, options, cb);
      }
    } else if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, data, false, options, cb]);
    } else {
      this.sendFrame(Sender.frame(data, options), cb);
    }
  }

  /**
   * Sends a data message to the other peer.
   *
   * @param {*} data The message to send
   * @param {Object} options Options object
   * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
   *     or text
   * @param {Boolean} [options.compress=false] Specifies whether or not to
   *     compress `data`
   * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
   *     last one
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Function} [cb] Callback
   * @public
   */
  send(data, options, cb) {
    const perMessageDeflate = this._extensions[PerMessageDeflate$1.extensionName];
    let opcode = options.binary ? 2 : 1;
    let rsv1 = options.compress;

    let byteLength;
    let readOnly;

    if (typeof data === 'string') {
      byteLength = Buffer.byteLength(data);
      readOnly = false;
    } else if (isBlob$1(data)) {
      byteLength = data.size;
      readOnly = false;
    } else {
      data = toBuffer$1(data);
      byteLength = data.length;
      readOnly = toBuffer$1.readOnly;
    }

    if (this._firstFragment) {
      this._firstFragment = false;
      if (
        rsv1 &&
        perMessageDeflate &&
        perMessageDeflate.params[
          perMessageDeflate._isServer
            ? 'server_no_context_takeover'
            : 'client_no_context_takeover'
        ]
      ) {
        rsv1 = byteLength >= perMessageDeflate._threshold;
      }
      this._compress = rsv1;
    } else {
      rsv1 = false;
      opcode = 0;
    }

    if (options.fin) this._firstFragment = true;

    const opts = {
      [kByteLength]: byteLength,
      fin: options.fin,
      generateMask: this._generateMask,
      mask: options.mask,
      maskBuffer: this._maskBuffer,
      opcode,
      readOnly,
      rsv1
    };

    if (isBlob$1(data)) {
      if (this._state !== DEFAULT) {
        this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
      } else {
        this.getBlobData(data, this._compress, opts, cb);
      }
    } else if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, data, this._compress, opts, cb]);
    } else {
      this.dispatch(data, this._compress, opts, cb);
    }
  }

  /**
   * Gets the contents of a blob as binary data.
   *
   * @param {Blob} blob The blob
   * @param {Boolean} [compress=false] Specifies whether or not to compress
   *     the data
   * @param {Object} options Options object
   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
   *     FIN bit
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
   *     key
   * @param {Number} options.opcode The opcode
   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
   *     modified
   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
   *     RSV1 bit
   * @param {Function} [cb] Callback
   * @private
   */
  getBlobData(blob, compress, options, cb) {
    this._bufferedBytes += options[kByteLength];
    this._state = GET_BLOB_DATA;

    blob
      .arrayBuffer()
      .then((arrayBuffer) => {
        if (this._socket.destroyed) {
          const err = new Error(
            'The socket was closed while the blob was being read'
          );

          //
          // `callCallbacks` is called in the next tick to ensure that errors
          // that might be thrown in the callbacks behave like errors thrown
          // outside the promise chain.
          //
          process.nextTick(callCallbacks, this, err, cb);
          return;
        }

        this._bufferedBytes -= options[kByteLength];
        const data = toBuffer$1(arrayBuffer);

        if (!compress) {
          this._state = DEFAULT;
          this.sendFrame(Sender.frame(data, options), cb);
          this.dequeue();
        } else {
          this.dispatch(data, compress, options, cb);
        }
      })
      .catch((err) => {
        //
        // `onError` is called in the next tick for the same reason that
        // `callCallbacks` above is.
        //
        process.nextTick(onError, this, err, cb);
      });
  }

  /**
   * Dispatches a message.
   *
   * @param {(Buffer|String)} data The message to send
   * @param {Boolean} [compress=false] Specifies whether or not to compress
   *     `data`
   * @param {Object} options Options object
   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
   *     FIN bit
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
   *     key
   * @param {Number} options.opcode The opcode
   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
   *     modified
   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
   *     RSV1 bit
   * @param {Function} [cb] Callback
   * @private
   */
  dispatch(data, compress, options, cb) {
    if (!compress) {
      this.sendFrame(Sender.frame(data, options), cb);
      return;
    }

    const perMessageDeflate = this._extensions[PerMessageDeflate$1.extensionName];

    this._bufferedBytes += options[kByteLength];
    this._state = DEFLATING;
    perMessageDeflate.compress(data, options.fin, (_, buf) => {
      if (this._socket.destroyed) {
        const err = new Error(
          'The socket was closed while data was being compressed'
        );

        callCallbacks(this, err, cb);
        return;
      }

      this._bufferedBytes -= options[kByteLength];
      this._state = DEFAULT;
      options.readOnly = false;
      this.sendFrame(Sender.frame(buf, options), cb);
      this.dequeue();
    });
  }

  /**
   * Executes queued send operations.
   *
   * @private
   */
  dequeue() {
    while (this._state === DEFAULT && this._queue.length) {
      const params = this._queue.shift();

      this._bufferedBytes -= params[3][kByteLength];
      Reflect.apply(params[0], this, params.slice(1));
    }
  }

  /**
   * Enqueues a send operation.
   *
   * @param {Array} params Send operation parameters.
   * @private
   */
  enqueue(params) {
    this._bufferedBytes += params[3][kByteLength];
    this._queue.push(params);
  }

  /**
   * Sends a frame.
   *
   * @param {(Buffer | String)[]} list The frame to send
   * @param {Function} [cb] Callback
   * @private
   */
  sendFrame(list, cb) {
    if (list.length === 2) {
      this._socket.cork();
      this._socket.write(list[0]);
      this._socket.write(list[1], cb);
      this._socket.uncork();
    } else {
      this._socket.write(list[0], cb);
    }
  }
};

var sender = Sender$1;

/**
 * Calls queued callbacks with an error.
 *
 * @param {Sender} sender The `Sender` instance
 * @param {Error} err The error to call the callbacks with
 * @param {Function} [cb] The first callback
 * @private
 */
function callCallbacks(sender, err, cb) {
  if (typeof cb === 'function') cb(err);

  for (let i = 0; i < sender._queue.length; i++) {
    const params = sender._queue[i];
    const callback = params[params.length - 1];

    if (typeof callback === 'function') callback(err);
  }
}

/**
 * Handles a `Sender` error.
 *
 * @param {Sender} sender The `Sender` instance
 * @param {Error} err The error
 * @param {Function} [cb] The first pending callback
 * @private
 */
function onError(sender, err, cb) {
  callCallbacks(sender, err, cb);
  sender.onerror(err);
}

const { kForOnEventAttribute: kForOnEventAttribute$1, kListener: kListener$1 } = constants;

const kCode = Symbol('kCode');
const kData = Symbol('kData');
const kError = Symbol('kError');
const kMessage = Symbol('kMessage');
const kReason = Symbol('kReason');
const kTarget = Symbol('kTarget');
const kType = Symbol('kType');
const kWasClean = Symbol('kWasClean');

/**
 * Class representing an event.
 */
let Event$1 = class Event {
  /**
   * Create a new `Event`.
   *
   * @param {String} type The name of the event
   * @throws {TypeError} If the `type` argument is not specified
   */
  constructor(type) {
    this[kTarget] = null;
    this[kType] = type;
  }

  /**
   * @type {*}
   */
  get target() {
    return this[kTarget];
  }

  /**
   * @type {String}
   */
  get type() {
    return this[kType];
  }
};

Object.defineProperty(Event$1.prototype, 'target', { enumerable: true });
Object.defineProperty(Event$1.prototype, 'type', { enumerable: true });

/**
 * Class representing a close event.
 *
 * @extends Event
 */
class CloseEvent extends Event$1 {
  /**
   * Create a new `CloseEvent`.
   *
   * @param {String} type The name of the event
   * @param {Object} [options] A dictionary object that allows for setting
   *     attributes via object members of the same name
   * @param {Number} [options.code=0] The status code explaining why the
   *     connection was closed
   * @param {String} [options.reason=''] A human-readable string explaining why
   *     the connection was closed
   * @param {Boolean} [options.wasClean=false] Indicates whether or not the
   *     connection was cleanly closed
   */
  constructor(type, options = {}) {
    super(type);

    this[kCode] = options.code === undefined ? 0 : options.code;
    this[kReason] = options.reason === undefined ? '' : options.reason;
    this[kWasClean] = options.wasClean === undefined ? false : options.wasClean;
  }

  /**
   * @type {Number}
   */
  get code() {
    return this[kCode];
  }

  /**
   * @type {String}
   */
  get reason() {
    return this[kReason];
  }

  /**
   * @type {Boolean}
   */
  get wasClean() {
    return this[kWasClean];
  }
}

Object.defineProperty(CloseEvent.prototype, 'code', { enumerable: true });
Object.defineProperty(CloseEvent.prototype, 'reason', { enumerable: true });
Object.defineProperty(CloseEvent.prototype, 'wasClean', { enumerable: true });

/**
 * Class representing an error event.
 *
 * @extends Event
 */
class ErrorEvent extends Event$1 {
  /**
   * Create a new `ErrorEvent`.
   *
   * @param {String} type The name of the event
   * @param {Object} [options] A dictionary object that allows for setting
   *     attributes via object members of the same name
   * @param {*} [options.error=null] The error that generated this event
   * @param {String} [options.message=''] The error message
   */
  constructor(type, options = {}) {
    super(type);

    this[kError] = options.error === undefined ? null : options.error;
    this[kMessage] = options.message === undefined ? '' : options.message;
  }

  /**
   * @type {*}
   */
  get error() {
    return this[kError];
  }

  /**
   * @type {String}
   */
  get message() {
    return this[kMessage];
  }
}

Object.defineProperty(ErrorEvent.prototype, 'error', { enumerable: true });
Object.defineProperty(ErrorEvent.prototype, 'message', { enumerable: true });

/**
 * Class representing a message event.
 *
 * @extends Event
 */
class MessageEvent extends Event$1 {
  /**
   * Create a new `MessageEvent`.
   *
   * @param {String} type The name of the event
   * @param {Object} [options] A dictionary object that allows for setting
   *     attributes via object members of the same name
   * @param {*} [options.data=null] The message content
   */
  constructor(type, options = {}) {
    super(type);

    this[kData] = options.data === undefined ? null : options.data;
  }

  /**
   * @type {*}
   */
  get data() {
    return this[kData];
  }
}

Object.defineProperty(MessageEvent.prototype, 'data', { enumerable: true });

/**
 * This provides methods for emulating the `EventTarget` interface. It's not
 * meant to be used directly.
 *
 * @mixin
 */
const EventTarget = {
  /**
   * Register an event listener.
   *
   * @param {String} type A string representing the event type to listen for
   * @param {(Function|Object)} handler The listener to add
   * @param {Object} [options] An options object specifies characteristics about
   *     the event listener
   * @param {Boolean} [options.once=false] A `Boolean` indicating that the
   *     listener should be invoked at most once after being added. If `true`,
   *     the listener would be automatically removed when invoked.
   * @public
   */
  addEventListener(type, handler, options = {}) {
    for (const listener of this.listeners(type)) {
      if (
        !options[kForOnEventAttribute$1] &&
        listener[kListener$1] === handler &&
        !listener[kForOnEventAttribute$1]
      ) {
        return;
      }
    }

    let wrapper;

    if (type === 'message') {
      wrapper = function onMessage(data, isBinary) {
        const event = new MessageEvent('message', {
          data: isBinary ? data : data.toString()
        });

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else if (type === 'close') {
      wrapper = function onClose(code, message) {
        const event = new CloseEvent('close', {
          code,
          reason: message.toString(),
          wasClean: this._closeFrameReceived && this._closeFrameSent
        });

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else if (type === 'error') {
      wrapper = function onError(error) {
        const event = new ErrorEvent('error', {
          error,
          message: error.message
        });

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else if (type === 'open') {
      wrapper = function onOpen() {
        const event = new Event$1('open');

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else {
      return;
    }

    wrapper[kForOnEventAttribute$1] = !!options[kForOnEventAttribute$1];
    wrapper[kListener$1] = handler;

    if (options.once) {
      this.once(type, wrapper);
    } else {
      this.on(type, wrapper);
    }
  },

  /**
   * Remove an event listener.
   *
   * @param {String} type A string representing the event type to remove
   * @param {(Function|Object)} handler The listener to remove
   * @public
   */
  removeEventListener(type, handler) {
    for (const listener of this.listeners(type)) {
      if (listener[kListener$1] === handler && !listener[kForOnEventAttribute$1]) {
        this.removeListener(type, listener);
        break;
      }
    }
  }
};

var eventTarget = {
  EventTarget};

/**
 * Call an event listener
 *
 * @param {(Function|Object)} listener The listener to call
 * @param {*} thisArg The value to use as `this`` when calling the listener
 * @param {Event} event The event to pass to the listener
 * @private
 */
function callListener(listener, thisArg, event) {
  if (typeof listener === 'object' && listener.handleEvent) {
    listener.handleEvent.call(listener, event);
  } else {
    listener.call(thisArg, event);
  }
}

const { tokenChars: tokenChars$1 } = validationExports;

/**
 * Adds an offer to the map of extension offers or a parameter to the map of
 * parameters.
 *
 * @param {Object} dest The map of extension offers or parameters
 * @param {String} name The extension or parameter name
 * @param {(Object|Boolean|String)} elem The extension parameters or the
 *     parameter value
 * @private
 */
function push(dest, name, elem) {
  if (dest[name] === undefined) dest[name] = [elem];
  else dest[name].push(elem);
}

/**
 * Parses the `Sec-WebSocket-Extensions` header into an object.
 *
 * @param {String} header The field value of the header
 * @return {Object} The parsed object
 * @public
 */
function parse$1(header) {
  const offers = Object.create(null);
  let params = Object.create(null);
  let mustUnescape = false;
  let isEscaping = false;
  let inQuotes = false;
  let extensionName;
  let paramName;
  let start = -1;
  let code = -1;
  let end = -1;
  let i = 0;

  for (; i < header.length; i++) {
    code = header.charCodeAt(i);

    if (extensionName === undefined) {
      if (end === -1 && tokenChars$1[code] === 1) {
        if (start === -1) start = i;
      } else if (
        i !== 0 &&
        (code === 0x20 /* ' ' */ || code === 0x09) /* '\t' */
      ) {
        if (end === -1 && start !== -1) end = i;
      } else if (code === 0x3b /* ';' */ || code === 0x2c /* ',' */) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        const name = header.slice(start, end);
        if (code === 0x2c) {
          push(offers, name, params);
          params = Object.create(null);
        } else {
          extensionName = name;
        }

        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    } else if (paramName === undefined) {
      if (end === -1 && tokenChars$1[code] === 1) {
        if (start === -1) start = i;
      } else if (code === 0x20 || code === 0x09) {
        if (end === -1 && start !== -1) end = i;
      } else if (code === 0x3b || code === 0x2c) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        push(params, header.slice(start, end), true);
        if (code === 0x2c) {
          push(offers, extensionName, params);
          params = Object.create(null);
          extensionName = undefined;
        }

        start = end = -1;
      } else if (code === 0x3d /* '=' */ && start !== -1 && end === -1) {
        paramName = header.slice(start, i);
        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    } else {
      //
      // The value of a quoted-string after unescaping must conform to the
      // token ABNF, so only token characters are valid.
      // Ref: https://tools.ietf.org/html/rfc6455#section-9.1
      //
      if (isEscaping) {
        if (tokenChars$1[code] !== 1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
        if (start === -1) start = i;
        else if (!mustUnescape) mustUnescape = true;
        isEscaping = false;
      } else if (inQuotes) {
        if (tokenChars$1[code] === 1) {
          if (start === -1) start = i;
        } else if (code === 0x22 /* '"' */ && start !== -1) {
          inQuotes = false;
          end = i;
        } else if (code === 0x5c /* '\' */) {
          isEscaping = true;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      } else if (code === 0x22 && header.charCodeAt(i - 1) === 0x3d) {
        inQuotes = true;
      } else if (end === -1 && tokenChars$1[code] === 1) {
        if (start === -1) start = i;
      } else if (start !== -1 && (code === 0x20 || code === 0x09)) {
        if (end === -1) end = i;
      } else if (code === 0x3b || code === 0x2c) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        let value = header.slice(start, end);
        if (mustUnescape) {
          value = value.replace(/\\/g, '');
          mustUnescape = false;
        }
        push(params, paramName, value);
        if (code === 0x2c) {
          push(offers, extensionName, params);
          params = Object.create(null);
          extensionName = undefined;
        }

        paramName = undefined;
        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    }
  }

  if (start === -1 || inQuotes || code === 0x20 || code === 0x09) {
    throw new SyntaxError('Unexpected end of input');
  }

  if (end === -1) end = i;
  const token = header.slice(start, end);
  if (extensionName === undefined) {
    push(offers, token, params);
  } else {
    if (paramName === undefined) {
      push(params, token, true);
    } else if (mustUnescape) {
      push(params, paramName, token.replace(/\\/g, ''));
    } else {
      push(params, paramName, token);
    }
    push(offers, extensionName, params);
  }

  return offers;
}

/**
 * Builds the `Sec-WebSocket-Extensions` header field value.
 *
 * @param {Object} extensions The map of extensions and parameters to format
 * @return {String} A string representing the given object
 * @public
 */
function format$1(extensions) {
  return Object.keys(extensions)
    .map((extension) => {
      let configurations = extensions[extension];
      if (!Array.isArray(configurations)) configurations = [configurations];
      return configurations
        .map((params) => {
          return [extension]
            .concat(
              Object.keys(params).map((k) => {
                let values = params[k];
                if (!Array.isArray(values)) values = [values];
                return values
                  .map((v) => (v === true ? k : `${k}=${v}`))
                  .join('; ');
              })
            )
            .join('; ');
        })
        .join(', ');
    })
    .join(', ');
}

var extension = { format: format$1, parse: parse$1 };

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex|Readable$", "caughtErrors": "none" }] */

const EventEmitter = require$$0$3;
const https = require$$1$1;
const http = require$$2$1;
const net = require$$3;
const tls = require$$4;
const { randomBytes, createHash: createHash$1 } = require$$1;
const { Duplex: Duplex$2, Readable } = require$$0$2;
const { URL: URL$1 } = require$$7;

const PerMessageDeflate = permessageDeflate;
const Receiver = receiver;
const Sender = sender;
const { isBlob } = validationExports;

const {
  BINARY_TYPES,
  CLOSE_TIMEOUT: CLOSE_TIMEOUT$1,
  EMPTY_BUFFER,
  GUID: GUID$1,
  kForOnEventAttribute,
  kListener,
  kStatusCode,
  kWebSocket: kWebSocket$1,
  NOOP
} = constants;
const {
  EventTarget: { addEventListener, removeEventListener }
} = eventTarget;
const { format, parse } = extension;
const { toBuffer } = bufferUtilExports;

const kAborted = Symbol('kAborted');
const protocolVersions = [8, 13];
const readyStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
const subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;

/**
 * Class representing a WebSocket.
 *
 * @extends EventEmitter
 */
class WebSocket extends EventEmitter {
  /**
   * Create a new `WebSocket`.
   *
   * @param {(String|URL)} address The URL to which to connect
   * @param {(String|String[])} [protocols] The subprotocols
   * @param {Object} [options] Connection options
   */
  constructor(address, protocols, options) {
    super();

    this._binaryType = BINARY_TYPES[0];
    this._closeCode = 1006;
    this._closeFrameReceived = false;
    this._closeFrameSent = false;
    this._closeMessage = EMPTY_BUFFER;
    this._closeTimer = null;
    this._errorEmitted = false;
    this._extensions = {};
    this._paused = false;
    this._protocol = '';
    this._readyState = WebSocket.CONNECTING;
    this._receiver = null;
    this._sender = null;
    this._socket = null;

    if (address !== null) {
      this._bufferedAmount = 0;
      this._isServer = false;
      this._redirects = 0;

      if (protocols === undefined) {
        protocols = [];
      } else if (!Array.isArray(protocols)) {
        if (typeof protocols === 'object' && protocols !== null) {
          options = protocols;
          protocols = [];
        } else {
          protocols = [protocols];
        }
      }

      initAsClient(this, address, protocols, options);
    } else {
      this._autoPong = options.autoPong;
      this._closeTimeout = options.closeTimeout;
      this._isServer = true;
    }
  }

  /**
   * For historical reasons, the custom "nodebuffer" type is used by the default
   * instead of "blob".
   *
   * @type {String}
   */
  get binaryType() {
    return this._binaryType;
  }

  set binaryType(type) {
    if (!BINARY_TYPES.includes(type)) return;

    this._binaryType = type;

    //
    // Allow to change `binaryType` on the fly.
    //
    if (this._receiver) this._receiver._binaryType = type;
  }

  /**
   * @type {Number}
   */
  get bufferedAmount() {
    if (!this._socket) return this._bufferedAmount;

    return this._socket._writableState.length + this._sender._bufferedBytes;
  }

  /**
   * @type {String}
   */
  get extensions() {
    return Object.keys(this._extensions).join();
  }

  /**
   * @type {Boolean}
   */
  get isPaused() {
    return this._paused;
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onclose() {
    return null;
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onerror() {
    return null;
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onopen() {
    return null;
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onmessage() {
    return null;
  }

  /**
   * @type {String}
   */
  get protocol() {
    return this._protocol;
  }

  /**
   * @type {Number}
   */
  get readyState() {
    return this._readyState;
  }

  /**
   * @type {String}
   */
  get url() {
    return this._url;
  }

  /**
   * Set up the socket and the internal resources.
   *
   * @param {Duplex} socket The network socket between the server and client
   * @param {Buffer} head The first packet of the upgraded stream
   * @param {Object} options Options object
   * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
   *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
   *     multiple times in the same tick
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Number} [options.maxBufferedChunks=0] The maximum number of
   *     buffered data chunks
   * @param {Number} [options.maxFragments=0] The maximum number of message
   *     fragments
   * @param {Number} [options.maxPayload=0] The maximum allowed message size
   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
   *     not to skip UTF-8 validation for text and close messages
   * @private
   */
  setSocket(socket, head, options) {
    const receiver = new Receiver({
      allowSynchronousEvents: options.allowSynchronousEvents,
      binaryType: this.binaryType,
      extensions: this._extensions,
      isServer: this._isServer,
      maxBufferedChunks: options.maxBufferedChunks,
      maxFragments: options.maxFragments,
      maxPayload: options.maxPayload,
      skipUTF8Validation: options.skipUTF8Validation
    });

    const sender = new Sender(socket, this._extensions, options.generateMask);

    this._receiver = receiver;
    this._sender = sender;
    this._socket = socket;

    receiver[kWebSocket$1] = this;
    sender[kWebSocket$1] = this;
    socket[kWebSocket$1] = this;

    receiver.on('conclude', receiverOnConclude);
    receiver.on('drain', receiverOnDrain);
    receiver.on('error', receiverOnError);
    receiver.on('message', receiverOnMessage);
    receiver.on('ping', receiverOnPing);
    receiver.on('pong', receiverOnPong);

    sender.onerror = senderOnError;

    //
    // These methods may not be available if `socket` is just a `Duplex`.
    //
    if (socket.setTimeout) socket.setTimeout(0);
    if (socket.setNoDelay) socket.setNoDelay();

    if (head.length > 0) socket.unshift(head);

    socket.on('close', socketOnClose);
    socket.on('data', socketOnData);
    socket.on('end', socketOnEnd);
    socket.on('error', socketOnError);

    this._readyState = WebSocket.OPEN;
    this.emit('open');
  }

  /**
   * Emit the `'close'` event.
   *
   * @private
   */
  emitClose() {
    if (!this._socket) {
      this._readyState = WebSocket.CLOSED;
      this.emit('close', this._closeCode, this._closeMessage);
      return;
    }

    if (this._extensions[PerMessageDeflate.extensionName]) {
      this._extensions[PerMessageDeflate.extensionName].cleanup();
    }

    this._receiver.removeAllListeners();
    this._readyState = WebSocket.CLOSED;
    this.emit('close', this._closeCode, this._closeMessage);
  }

  /**
   * Start a closing handshake.
   *
   *          +----------+   +-----------+   +----------+
   *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
   *    |     +----------+   +-----------+   +----------+     |
   *          +----------+   +-----------+         |
   * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
   *          +----------+   +-----------+   |
   *    |           |                        |   +---+        |
   *                +------------------------+-->|fin| - - - -
   *    |         +---+                      |   +---+
   *     - - - - -|fin|<---------------------+
   *              +---+
   *
   * @param {Number} [code] Status code explaining why the connection is closing
   * @param {(String|Buffer)} [data] The reason why the connection is
   *     closing
   * @public
   */
  close(code, data) {
    if (this.readyState === WebSocket.CLOSED) return;
    if (this.readyState === WebSocket.CONNECTING) {
      const msg = 'WebSocket was closed before the connection was established';
      abortHandshake(this, this._req, msg);
      return;
    }

    if (this.readyState === WebSocket.CLOSING) {
      if (
        this._closeFrameSent &&
        (this._closeFrameReceived || this._receiver._writableState.errorEmitted)
      ) {
        this._socket.end();
      }

      return;
    }

    this._readyState = WebSocket.CLOSING;
    this._sender.close(code, data, !this._isServer, (err) => {
      //
      // This error is handled by the `'error'` listener on the socket. We only
      // want to know if the close frame has been sent here.
      //
      if (err) return;

      this._closeFrameSent = true;

      if (
        this._closeFrameReceived ||
        this._receiver._writableState.errorEmitted
      ) {
        this._socket.end();
      }
    });

    setCloseTimer(this);
  }

  /**
   * Pause the socket.
   *
   * @public
   */
  pause() {
    if (
      this.readyState === WebSocket.CONNECTING ||
      this.readyState === WebSocket.CLOSED
    ) {
      return;
    }

    this._paused = true;
    this._socket.pause();
  }

  /**
   * Send a ping.
   *
   * @param {*} [data] The data to send
   * @param {Boolean} [mask] Indicates whether or not to mask `data`
   * @param {Function} [cb] Callback which is executed when the ping is sent
   * @public
   */
  ping(data, mask, cb) {
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof data === 'function') {
      cb = data;
      data = mask = undefined;
    } else if (typeof mask === 'function') {
      cb = mask;
      mask = undefined;
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    if (mask === undefined) mask = !this._isServer;
    this._sender.ping(data || EMPTY_BUFFER, mask, cb);
  }

  /**
   * Send a pong.
   *
   * @param {*} [data] The data to send
   * @param {Boolean} [mask] Indicates whether or not to mask `data`
   * @param {Function} [cb] Callback which is executed when the pong is sent
   * @public
   */
  pong(data, mask, cb) {
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof data === 'function') {
      cb = data;
      data = mask = undefined;
    } else if (typeof mask === 'function') {
      cb = mask;
      mask = undefined;
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    if (mask === undefined) mask = !this._isServer;
    this._sender.pong(data || EMPTY_BUFFER, mask, cb);
  }

  /**
   * Resume the socket.
   *
   * @public
   */
  resume() {
    if (
      this.readyState === WebSocket.CONNECTING ||
      this.readyState === WebSocket.CLOSED
    ) {
      return;
    }

    this._paused = false;
    if (!this._receiver._writableState.needDrain) this._socket.resume();
  }

  /**
   * Send a data message.
   *
   * @param {*} data The message to send
   * @param {Object} [options] Options object
   * @param {Boolean} [options.binary] Specifies whether `data` is binary or
   *     text
   * @param {Boolean} [options.compress] Specifies whether or not to compress
   *     `data`
   * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
   *     last one
   * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback which is executed when data is written out
   * @public
   */
  send(data, options, cb) {
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    const opts = {
      binary: typeof data !== 'string',
      mask: !this._isServer,
      compress: true,
      fin: true,
      ...options
    };

    if (!this._extensions[PerMessageDeflate.extensionName]) {
      opts.compress = false;
    }

    this._sender.send(data || EMPTY_BUFFER, opts, cb);
  }

  /**
   * Forcibly close the connection.
   *
   * @public
   */
  terminate() {
    if (this.readyState === WebSocket.CLOSED) return;
    if (this.readyState === WebSocket.CONNECTING) {
      const msg = 'WebSocket was closed before the connection was established';
      abortHandshake(this, this._req, msg);
      return;
    }

    if (this._socket) {
      this._readyState = WebSocket.CLOSING;
      this._socket.destroy();
    }
  }
}

/**
 * @constant {Number} CONNECTING
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CONNECTING', {
  enumerable: true,
  value: readyStates.indexOf('CONNECTING')
});

/**
 * @constant {Number} CONNECTING
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CONNECTING', {
  enumerable: true,
  value: readyStates.indexOf('CONNECTING')
});

/**
 * @constant {Number} OPEN
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'OPEN', {
  enumerable: true,
  value: readyStates.indexOf('OPEN')
});

/**
 * @constant {Number} OPEN
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'OPEN', {
  enumerable: true,
  value: readyStates.indexOf('OPEN')
});

/**
 * @constant {Number} CLOSING
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CLOSING', {
  enumerable: true,
  value: readyStates.indexOf('CLOSING')
});

/**
 * @constant {Number} CLOSING
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CLOSING', {
  enumerable: true,
  value: readyStates.indexOf('CLOSING')
});

/**
 * @constant {Number} CLOSED
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CLOSED', {
  enumerable: true,
  value: readyStates.indexOf('CLOSED')
});

/**
 * @constant {Number} CLOSED
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CLOSED', {
  enumerable: true,
  value: readyStates.indexOf('CLOSED')
});

[
  'binaryType',
  'bufferedAmount',
  'extensions',
  'isPaused',
  'protocol',
  'readyState',
  'url'
].forEach((property) => {
  Object.defineProperty(WebSocket.prototype, property, { enumerable: true });
});

//
// Add the `onopen`, `onerror`, `onclose`, and `onmessage` attributes.
// See https://html.spec.whatwg.org/multipage/comms.html#the-websocket-interface
//
['open', 'error', 'close', 'message'].forEach((method) => {
  Object.defineProperty(WebSocket.prototype, `on${method}`, {
    enumerable: true,
    get() {
      for (const listener of this.listeners(method)) {
        if (listener[kForOnEventAttribute]) return listener[kListener];
      }

      return null;
    },
    set(handler) {
      for (const listener of this.listeners(method)) {
        if (listener[kForOnEventAttribute]) {
          this.removeListener(method, listener);
          break;
        }
      }

      if (typeof handler !== 'function') return;

      this.addEventListener(method, handler, {
        [kForOnEventAttribute]: true
      });
    }
  });
});

WebSocket.prototype.addEventListener = addEventListener;
WebSocket.prototype.removeEventListener = removeEventListener;

var websocket = WebSocket;

/**
 * Initialize a WebSocket client.
 *
 * @param {WebSocket} websocket The client to initialize
 * @param {(String|URL)} address The URL to which to connect
 * @param {Array} protocols The subprotocols
 * @param {Object} [options] Connection options
 * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether any
 *     of the `'message'`, `'ping'`, and `'pong'` events can be emitted multiple
 *     times in the same tick
 * @param {Boolean} [options.autoPong=true] Specifies whether or not to
 *     automatically send a pong in response to a ping
 * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to wait
 *     for the closing handshake to finish after `websocket.close()` is called
 * @param {Function} [options.finishRequest] A function which can be used to
 *     customize the headers of each http request before it is sent
 * @param {Boolean} [options.followRedirects=false] Whether or not to follow
 *     redirects
 * @param {Function} [options.generateMask] The function used to generate the
 *     masking key
 * @param {Number} [options.handshakeTimeout] Timeout in milliseconds for the
 *     handshake request
 * @param {Number} [options.maxBufferedChunks=1048576] The maximum number of
 *     buffered data chunks
 * @param {Number} [options.maxFragments=131072] The maximum number of message
 *     fragments
 * @param {Number} [options.maxPayload=104857600] The maximum allowed message
 *     size
 * @param {Number} [options.maxRedirects=10] The maximum number of redirects
 *     allowed
 * @param {String} [options.origin] Value of the `Origin` or
 *     `Sec-WebSocket-Origin` header
 * @param {(Boolean|Object)} [options.perMessageDeflate=true] Enable/disable
 *     permessage-deflate
 * @param {Number} [options.protocolVersion=13] Value of the
 *     `Sec-WebSocket-Version` header
 * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
 *     not to skip UTF-8 validation for text and close messages
 * @private
 */
function initAsClient(websocket, address, protocols, options) {
  const opts = {
    allowSynchronousEvents: true,
    autoPong: true,
    closeTimeout: CLOSE_TIMEOUT$1,
    protocolVersion: protocolVersions[1],
    maxBufferedChunks: 1024 * 1024,
    maxFragments: 128 * 1024,
    maxPayload: 100 * 1024 * 1024,
    skipUTF8Validation: false,
    perMessageDeflate: true,
    followRedirects: false,
    maxRedirects: 10,
    ...options,
    socketPath: undefined,
    hostname: undefined,
    protocol: undefined,
    timeout: undefined,
    method: 'GET',
    host: undefined,
    path: undefined,
    port: undefined
  };

  websocket._autoPong = opts.autoPong;
  websocket._closeTimeout = opts.closeTimeout;

  if (!protocolVersions.includes(opts.protocolVersion)) {
    throw new RangeError(
      `Unsupported protocol version: ${opts.protocolVersion} ` +
        `(supported versions: ${protocolVersions.join(', ')})`
    );
  }

  let parsedUrl;

  if (address instanceof URL$1) {
    parsedUrl = address;
  } else {
    try {
      parsedUrl = new URL$1(address);
    } catch {
      throw new SyntaxError(`Invalid URL: ${address}`);
    }
  }

  if (parsedUrl.protocol === 'http:') {
    parsedUrl.protocol = 'ws:';
  } else if (parsedUrl.protocol === 'https:') {
    parsedUrl.protocol = 'wss:';
  }

  websocket._url = parsedUrl.href;

  const isSecure = parsedUrl.protocol === 'wss:';
  const isIpcUrl = parsedUrl.protocol === 'ws+unix:';
  let invalidUrlMessage;

  if (parsedUrl.protocol !== 'ws:' && !isSecure && !isIpcUrl) {
    invalidUrlMessage =
      'The URL\'s protocol must be one of "ws:", "wss:", ' +
      '"http:", "https:", or "ws+unix:"';
  } else if (isIpcUrl && !parsedUrl.pathname) {
    invalidUrlMessage = "The URL's pathname is empty";
  } else if (parsedUrl.hash) {
    invalidUrlMessage = 'The URL contains a fragment identifier';
  }

  if (invalidUrlMessage) {
    const err = new SyntaxError(invalidUrlMessage);

    if (websocket._redirects === 0) {
      throw err;
    } else {
      emitErrorAndClose(websocket, err);
      return;
    }
  }

  const defaultPort = isSecure ? 443 : 80;
  const key = randomBytes(16).toString('base64');
  const request = isSecure ? https.request : http.request;
  const protocolSet = new Set();
  let perMessageDeflate;

  opts.createConnection =
    opts.createConnection || (isSecure ? tlsConnect : netConnect);
  opts.defaultPort = opts.defaultPort || defaultPort;
  opts.port = parsedUrl.port || defaultPort;
  opts.host = parsedUrl.hostname.startsWith('[')
    ? parsedUrl.hostname.slice(1, -1)
    : parsedUrl.hostname;
  opts.headers = {
    ...opts.headers,
    'Sec-WebSocket-Version': opts.protocolVersion,
    'Sec-WebSocket-Key': key,
    Connection: 'Upgrade',
    Upgrade: 'websocket'
  };
  opts.path = parsedUrl.pathname + parsedUrl.search;
  opts.timeout = opts.handshakeTimeout;

  if (opts.perMessageDeflate) {
    perMessageDeflate = new PerMessageDeflate({
      ...opts.perMessageDeflate,
      isServer: false,
      maxPayload: opts.maxPayload
    });
    opts.headers['Sec-WebSocket-Extensions'] = format({
      [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
    });
  }
  if (protocols.length) {
    for (const protocol of protocols) {
      if (
        typeof protocol !== 'string' ||
        !subprotocolRegex.test(protocol) ||
        protocolSet.has(protocol)
      ) {
        throw new SyntaxError(
          'An invalid or duplicated subprotocol was specified'
        );
      }

      protocolSet.add(protocol);
    }

    opts.headers['Sec-WebSocket-Protocol'] = protocols.join(',');
  }
  if (opts.origin) {
    if (opts.protocolVersion < 13) {
      opts.headers['Sec-WebSocket-Origin'] = opts.origin;
    } else {
      opts.headers.Origin = opts.origin;
    }
  }
  if (parsedUrl.username || parsedUrl.password) {
    opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
  }

  if (isIpcUrl) {
    const parts = opts.path.split(':');

    opts.socketPath = parts[0];
    opts.path = parts[1];
  }

  let req;

  if (opts.followRedirects) {
    if (websocket._redirects === 0) {
      websocket._originalIpc = isIpcUrl;
      websocket._originalSecure = isSecure;
      websocket._originalHostOrSocketPath = isIpcUrl
        ? opts.socketPath
        : parsedUrl.host;

      const headers = options && options.headers;

      //
      // Shallow copy the user provided options so that headers can be changed
      // without mutating the original object.
      //
      options = { ...options, headers: {} };

      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          options.headers[key.toLowerCase()] = value;
        }
      }
    } else if (websocket.listenerCount('redirect') === 0) {
      const isSameHost = isIpcUrl
        ? websocket._originalIpc
          ? opts.socketPath === websocket._originalHostOrSocketPath
          : false
        : websocket._originalIpc
          ? false
          : parsedUrl.host === websocket._originalHostOrSocketPath;

      if (!isSameHost || (websocket._originalSecure && !isSecure)) {
        //
        // Match curl 7.77.0 behavior and drop the following headers. These
        // headers are also dropped when following a redirect to a subdomain.
        //
        delete opts.headers.authorization;
        delete opts.headers.cookie;

        if (!isSameHost) delete opts.headers.host;

        opts.auth = undefined;
      }
    }

    //
    // Match curl 7.77.0 behavior and make the first `Authorization` header win.
    // If the `Authorization` header is set, then there is nothing to do as it
    // will take precedence.
    //
    if (opts.auth && !options.headers.authorization) {
      options.headers.authorization =
        'Basic ' + Buffer.from(opts.auth).toString('base64');
    }

    req = websocket._req = request(opts);

    if (websocket._redirects) {
      //
      // Unlike what is done for the `'upgrade'` event, no early exit is
      // triggered here if the user calls `websocket.close()` or
      // `websocket.terminate()` from a listener of the `'redirect'` event. This
      // is because the user can also call `request.destroy()` with an error
      // before calling `websocket.close()` or `websocket.terminate()` and this
      // would result in an error being emitted on the `request` object with no
      // `'error'` event listeners attached.
      //
      websocket.emit('redirect', websocket.url, req);
    }
  } else {
    req = websocket._req = request(opts);
  }

  if (opts.timeout) {
    req.on('timeout', () => {
      abortHandshake(websocket, req, 'Opening handshake has timed out');
    });
  }

  req.on('error', (err) => {
    if (req === null || req[kAborted]) return;

    req = websocket._req = null;
    emitErrorAndClose(websocket, err);
  });

  req.on('response', (res) => {
    const location = res.headers.location;
    const statusCode = res.statusCode;

    if (
      location &&
      opts.followRedirects &&
      statusCode >= 300 &&
      statusCode < 400
    ) {
      if (++websocket._redirects > opts.maxRedirects) {
        abortHandshake(websocket, req, 'Maximum redirects exceeded');
        return;
      }

      req.abort();

      let addr;

      try {
        addr = new URL$1(location, address);
      } catch (e) {
        const err = new SyntaxError(`Invalid URL: ${location}`);
        emitErrorAndClose(websocket, err);
        return;
      }

      initAsClient(websocket, addr, protocols, options);
    } else if (!websocket.emit('unexpected-response', req, res)) {
      abortHandshake(
        websocket,
        req,
        `Unexpected server response: ${res.statusCode}`
      );
    }
  });

  req.on('upgrade', (res, socket, head) => {
    websocket.emit('upgrade', res);

    //
    // The user may have closed the connection from a listener of the
    // `'upgrade'` event.
    //
    if (websocket.readyState !== WebSocket.CONNECTING) return;

    req = websocket._req = null;

    const upgrade = res.headers.upgrade;

    if (upgrade === undefined || upgrade.toLowerCase() !== 'websocket') {
      abortHandshake(websocket, socket, 'Invalid Upgrade header');
      return;
    }

    const digest = createHash$1('sha1')
      .update(key + GUID$1)
      .digest('base64');

    if (res.headers['sec-websocket-accept'] !== digest) {
      abortHandshake(websocket, socket, 'Invalid Sec-WebSocket-Accept header');
      return;
    }

    const serverProt = res.headers['sec-websocket-protocol'];
    let protError;

    if (serverProt !== undefined) {
      if (!protocolSet.size) {
        protError = 'Server sent a subprotocol but none was requested';
      } else if (!protocolSet.has(serverProt)) {
        protError = 'Server sent an invalid subprotocol';
      }
    } else if (protocolSet.size) {
      protError = 'Server sent no subprotocol';
    }

    if (protError) {
      abortHandshake(websocket, socket, protError);
      return;
    }

    if (serverProt) websocket._protocol = serverProt;

    const secWebSocketExtensions = res.headers['sec-websocket-extensions'];

    if (secWebSocketExtensions !== undefined) {
      if (!perMessageDeflate) {
        const message =
          'Server sent a Sec-WebSocket-Extensions header but no extension ' +
          'was requested';
        abortHandshake(websocket, socket, message);
        return;
      }

      let extensions;

      try {
        extensions = parse(secWebSocketExtensions);
      } catch (err) {
        const message = 'Invalid Sec-WebSocket-Extensions header';
        abortHandshake(websocket, socket, message);
        return;
      }

      const extensionNames = Object.keys(extensions);

      if (
        extensionNames.length !== 1 ||
        extensionNames[0] !== PerMessageDeflate.extensionName
      ) {
        const message = 'Server indicated an extension that was not requested';
        abortHandshake(websocket, socket, message);
        return;
      }

      try {
        perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
      } catch (err) {
        const message = 'Invalid Sec-WebSocket-Extensions header';
        abortHandshake(websocket, socket, message);
        return;
      }

      websocket._extensions[PerMessageDeflate.extensionName] =
        perMessageDeflate;
    }

    websocket.setSocket(socket, head, {
      allowSynchronousEvents: opts.allowSynchronousEvents,
      generateMask: opts.generateMask,
      maxBufferedChunks: opts.maxBufferedChunks,
      maxFragments: opts.maxFragments,
      maxPayload: opts.maxPayload,
      skipUTF8Validation: opts.skipUTF8Validation
    });
  });

  if (opts.finishRequest) {
    opts.finishRequest(req, websocket);
  } else {
    req.end();
  }
}

/**
 * Emit the `'error'` and `'close'` events.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {Error} The error to emit
 * @private
 */
function emitErrorAndClose(websocket, err) {
  websocket._readyState = WebSocket.CLOSING;
  //
  // The following assignment is practically useless and is done only for
  // consistency.
  //
  websocket._errorEmitted = true;
  websocket.emit('error', err);
  websocket.emitClose();
}

/**
 * Create a `net.Socket` and initiate a connection.
 *
 * @param {Object} options Connection options
 * @return {net.Socket} The newly created socket used to start the connection
 * @private
 */
function netConnect(options) {
  options.path = options.socketPath;
  return net.connect(options);
}

/**
 * Create a `tls.TLSSocket` and initiate a connection.
 *
 * @param {Object} options Connection options
 * @return {tls.TLSSocket} The newly created socket used to start the connection
 * @private
 */
function tlsConnect(options) {
  options.path = undefined;

  if (!options.servername && options.servername !== '') {
    options.servername = net.isIP(options.host) ? '' : options.host;
  }

  return tls.connect(options);
}

/**
 * Abort the handshake and emit an error.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {(http.ClientRequest|net.Socket|tls.Socket)} stream The request to
 *     abort or the socket to destroy
 * @param {String} message The error message
 * @private
 */
function abortHandshake(websocket, stream, message) {
  websocket._readyState = WebSocket.CLOSING;

  const err = new Error(message);
  Error.captureStackTrace(err, abortHandshake);

  if (stream.setHeader) {
    stream[kAborted] = true;
    stream.abort();

    if (stream.socket && !stream.socket.destroyed) {
      //
      // On Node.js >= 14.3.0 `request.abort()` does not destroy the socket if
      // called after the request completed. See
      // https://github.com/websockets/ws/issues/1869.
      //
      stream.socket.destroy();
    }

    process.nextTick(emitErrorAndClose, websocket, err);
  } else {
    stream.destroy(err);
    stream.once('error', websocket.emit.bind(websocket, 'error'));
    stream.once('close', websocket.emitClose.bind(websocket));
  }
}

/**
 * Handle cases where the `ping()`, `pong()`, or `send()` methods are called
 * when the `readyState` attribute is `CLOSING` or `CLOSED`.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {*} [data] The data to send
 * @param {Function} [cb] Callback
 * @private
 */
function sendAfterClose(websocket, data, cb) {
  if (data) {
    const length = isBlob(data) ? data.size : toBuffer(data).length;

    //
    // The `_bufferedAmount` property is used only when the peer is a client and
    // the opening handshake fails. Under these circumstances, in fact, the
    // `setSocket()` method is not called, so the `_socket` and `_sender`
    // properties are set to `null`.
    //
    if (websocket._socket) websocket._sender._bufferedBytes += length;
    else websocket._bufferedAmount += length;
  }

  if (cb) {
    const err = new Error(
      `WebSocket is not open: readyState ${websocket.readyState} ` +
        `(${readyStates[websocket.readyState]})`
    );
    process.nextTick(cb, err);
  }
}

/**
 * The listener of the `Receiver` `'conclude'` event.
 *
 * @param {Number} code The status code
 * @param {Buffer} reason The reason for closing
 * @private
 */
function receiverOnConclude(code, reason) {
  const websocket = this[kWebSocket$1];

  websocket._closeFrameReceived = true;
  websocket._closeMessage = reason;
  websocket._closeCode = code;

  if (websocket._socket[kWebSocket$1] === undefined) return;

  websocket._socket.removeListener('data', socketOnData);
  process.nextTick(resume, websocket._socket);

  if (code === 1005) websocket.close();
  else websocket.close(code, reason);
}

/**
 * The listener of the `Receiver` `'drain'` event.
 *
 * @private
 */
function receiverOnDrain() {
  const websocket = this[kWebSocket$1];

  if (!websocket.isPaused) websocket._socket.resume();
}

/**
 * The listener of the `Receiver` `'error'` event.
 *
 * @param {(RangeError|Error)} err The emitted error
 * @private
 */
function receiverOnError(err) {
  const websocket = this[kWebSocket$1];

  if (websocket._socket[kWebSocket$1] !== undefined) {
    websocket._socket.removeListener('data', socketOnData);

    //
    // On Node.js < 14.0.0 the `'error'` event is emitted synchronously. See
    // https://github.com/websockets/ws/issues/1940.
    //
    process.nextTick(resume, websocket._socket);

    websocket.close(err[kStatusCode]);
  }

  if (!websocket._errorEmitted) {
    websocket._errorEmitted = true;
    websocket.emit('error', err);
  }
}

/**
 * The listener of the `Receiver` `'finish'` event.
 *
 * @private
 */
function receiverOnFinish() {
  this[kWebSocket$1].emitClose();
}

/**
 * The listener of the `Receiver` `'message'` event.
 *
 * @param {Buffer|ArrayBuffer|Buffer[])} data The message
 * @param {Boolean} isBinary Specifies whether the message is binary or not
 * @private
 */
function receiverOnMessage(data, isBinary) {
  this[kWebSocket$1].emit('message', data, isBinary);
}

/**
 * The listener of the `Receiver` `'ping'` event.
 *
 * @param {Buffer} data The data included in the ping frame
 * @private
 */
function receiverOnPing(data) {
  const websocket = this[kWebSocket$1];

  if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
  websocket.emit('ping', data);
}

/**
 * The listener of the `Receiver` `'pong'` event.
 *
 * @param {Buffer} data The data included in the pong frame
 * @private
 */
function receiverOnPong(data) {
  this[kWebSocket$1].emit('pong', data);
}

/**
 * Resume a readable stream
 *
 * @param {Readable} stream The readable stream
 * @private
 */
function resume(stream) {
  stream.resume();
}

/**
 * The `Sender` error event handler.
 *
 * @param {Error} The error
 * @private
 */
function senderOnError(err) {
  const websocket = this[kWebSocket$1];

  if (websocket.readyState === WebSocket.CLOSED) return;
  if (websocket.readyState === WebSocket.OPEN) {
    websocket._readyState = WebSocket.CLOSING;
    setCloseTimer(websocket);
  }

  //
  // `socket.end()` is used instead of `socket.destroy()` to allow the other
  // peer to finish sending queued data. There is no need to set a timer here
  // because `CLOSING` means that it is already set or not needed.
  //
  this._socket.end();

  if (!websocket._errorEmitted) {
    websocket._errorEmitted = true;
    websocket.emit('error', err);
  }
}

/**
 * Set a timer to destroy the underlying raw socket of a WebSocket.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @private
 */
function setCloseTimer(websocket) {
  websocket._closeTimer = setTimeout(
    websocket._socket.destroy.bind(websocket._socket),
    websocket._closeTimeout
  );
}

/**
 * The listener of the socket `'close'` event.
 *
 * @private
 */
function socketOnClose() {
  const websocket = this[kWebSocket$1];

  this.removeListener('close', socketOnClose);
  this.removeListener('data', socketOnData);
  this.removeListener('end', socketOnEnd);

  websocket._readyState = WebSocket.CLOSING;

  //
  // The close frame might not have been received or the `'end'` event emitted,
  // for example, if the socket was destroyed due to an error. Ensure that the
  // `receiver` stream is closed after writing any remaining buffered data to
  // it. If the readable side of the socket is in flowing mode then there is no
  // buffered data as everything has been already written. If instead, the
  // socket is paused, any possible buffered data will be read as a single
  // chunk.
  //
  if (
    !this._readableState.endEmitted &&
    !websocket._closeFrameReceived &&
    !websocket._receiver._writableState.errorEmitted &&
    this._readableState.length !== 0
  ) {
    const chunk = this.read(this._readableState.length);

    websocket._receiver.write(chunk);
  }

  websocket._receiver.end();

  this[kWebSocket$1] = undefined;

  clearTimeout(websocket._closeTimer);

  if (
    websocket._receiver._writableState.finished ||
    websocket._receiver._writableState.errorEmitted
  ) {
    websocket.emitClose();
  } else {
    websocket._receiver.on('error', receiverOnFinish);
    websocket._receiver.on('finish', receiverOnFinish);
  }
}

/**
 * The listener of the socket `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function socketOnData(chunk) {
  if (!this[kWebSocket$1]._receiver.write(chunk)) {
    this.pause();
  }
}

/**
 * The listener of the socket `'end'` event.
 *
 * @private
 */
function socketOnEnd() {
  const websocket = this[kWebSocket$1];

  websocket._readyState = WebSocket.CLOSING;
  websocket._receiver.end();
  this.end();
}

/**
 * The listener of the socket `'error'` event.
 *
 * @private
 */
function socketOnError() {
  const websocket = this[kWebSocket$1];

  this.removeListener('error', socketOnError);
  this.on('error', NOOP);

  if (websocket) {
    websocket._readyState = WebSocket.CLOSING;
    this.destroy();
  }
}

var WebSocket$1 = /*@__PURE__*/getDefaultExportFromCjs(websocket);

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^WebSocket$" }] */
const { Duplex: Duplex$1 } = require$$0$2;

const { tokenChars } = validationExports;

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex$", "caughtErrors": "none" }] */
const { Duplex } = require$$0$2;
const { createHash } = require$$1;
const { CLOSE_TIMEOUT, GUID, kWebSocket } = constants;

/**!
 * @author Elgato
 * @module elgato/streamdeck
 * @license MIT
 * @copyright Copyright (c) Corsair Memory Inc.
 */
/**
 * Stream Deck device types.
 */
var DeviceType;
(function (DeviceType) {
    /**
     * Stream Deck, comprised of 15 customizable LCD keys in a 5 x 3 layout.
     */
    DeviceType[DeviceType["StreamDeck"] = 0] = "StreamDeck";
    /**
     * Stream Deck Mini, comprised of 6 customizable LCD keys in a 3 x 2 layout.
     */
    DeviceType[DeviceType["StreamDeckMini"] = 1] = "StreamDeckMini";
    /**
     * Stream Deck XL, comprised of 32 customizable LCD keys in an 8 x 4 layout.
     */
    DeviceType[DeviceType["StreamDeckXL"] = 2] = "StreamDeckXL";
    /**
     * Stream Deck Mobile, for iOS and Android.
     */
    DeviceType[DeviceType["StreamDeckMobile"] = 3] = "StreamDeckMobile";
    /**
     * Corsair G Keys, available on select Corsair keyboards.
     */
    DeviceType[DeviceType["CorsairGKeys"] = 4] = "CorsairGKeys";
    /**
     * Stream Deck Pedal, comprised of 3 customizable pedals.
     */
    DeviceType[DeviceType["StreamDeckPedal"] = 5] = "StreamDeckPedal";
    /**
     * Corsair Voyager laptop, comprising 10 buttons in a horizontal line above the keyboard.
     */
    DeviceType[DeviceType["CorsairVoyager"] = 6] = "CorsairVoyager";
    /**
     * Stream Deck +, comprised of 8 customizable LCD keys in a 4 x 2 layout, a touch strip, and 4 dials.
     */
    DeviceType[DeviceType["StreamDeckPlus"] = 7] = "StreamDeckPlus";
    /**
     * SCUF controller G keys, available on select SCUF controllers, for example SCUF Envision.
     */
    DeviceType[DeviceType["SCUFController"] = 8] = "SCUFController";
    /**
     * Stream Deck Neo, comprised of 8 customizable LCD keys in a 4 x 2 layout, an info bar, and 2 touch points for page navigation.
     */
    DeviceType[DeviceType["StreamDeckNeo"] = 9] = "StreamDeckNeo";
    /**
     * Stream Deck Studio, comprised of 32 customizable LCD keys in a 16 x 2 layout, and 2 dials (1 on either side).
     */
    DeviceType[DeviceType["StreamDeckStudio"] = 10] = "StreamDeckStudio";
    /**
     * Virtual Stream Deck, comprised of 1 to 64 action (on-screen) on a scalable canvas, with a maximum layout of 8 x 8.
     */
    DeviceType[DeviceType["VirtualStreamDeck"] = 11] = "VirtualStreamDeck";
    /**
     * High-performance gaming keyboard, with a built-in Stream Deck comprised of 12 customizable LCD keys in a 3 x 4 layout, an LCD screen, and 2 dials.
     */
    DeviceType[DeviceType["Galleon100SD"] = 12] = "Galleon100SD";
    /**
     * Stream Deck + XL, comprised of 36 customizable LCD keys in a 9 x 4 layout, a touch strip, and 6 dials.
     */
    DeviceType[DeviceType["StreamDeckPlusXL"] = 13] = "StreamDeckPlusXL";
})(DeviceType || (DeviceType = {}));

/**
 * List of available types that can be applied to {@link Bar} and {@link GBar} to determine their style.
 */
var BarSubType;
(function (BarSubType) {
    /**
     * Rectangle bar; the bar fills from left to right, determined by the {@link Bar.value}, similar to a standard progress bar.
     */
    BarSubType[BarSubType["Rectangle"] = 0] = "Rectangle";
    /**
     * Rectangle bar; the bar fills outwards from the centre of the bar, determined by the {@link Bar.value}.
     * @example
     * // Value is 2, range is 1-10.
     * // [  ███     ]
     * @example
     * // Value is 10, range is 1-10.
     * // [     █████]
     */
    BarSubType[BarSubType["DoubleRectangle"] = 1] = "DoubleRectangle";
    /**
     * Trapezoid bar, represented as a right-angle triangle; the bar fills from left to right, determined by the {@link Bar.value}, similar to a volume meter.
     */
    BarSubType[BarSubType["Trapezoid"] = 2] = "Trapezoid";
    /**
     * Trapezoid bar, represented by two right-angle triangles; the bar fills outwards from the centre of the bar, determined by the {@link Bar.value}. See {@link BarSubType.DoubleRectangle}.
     */
    BarSubType[BarSubType["DoubleTrapezoid"] = 3] = "DoubleTrapezoid";
    /**
     * Rounded rectangle bar; the bar fills from left to right, determined by the {@link Bar.value}, similar to a standard progress bar.
     */
    BarSubType[BarSubType["Groove"] = 4] = "Groove";
})(BarSubType || (BarSubType = {}));

/**
 * Defines the type of argument supplied by Stream Deck.
 */
var RegistrationParameter;
(function (RegistrationParameter) {
    /**
     * Identifies the argument that specifies the web socket port that Stream Deck is listening on.
     */
    RegistrationParameter["Port"] = "-port";
    /**
     * Identifies the argument that supplies information about the Stream Deck and the plugin.
     */
    RegistrationParameter["Info"] = "-info";
    /**
     * Identifies the argument that specifies the unique identifier that can be used when registering the plugin.
     */
    RegistrationParameter["PluginUUID"] = "-pluginUUID";
    /**
     * Identifies the argument that specifies the event to be sent to Stream Deck as part of the registration procedure.
     */
    RegistrationParameter["RegisterEvent"] = "-registerEvent";
})(RegistrationParameter || (RegistrationParameter = {}));

/**
 * Defines the target of a request, i.e. whether the request should update the Stream Deck hardware, Stream Deck software (application), or both, when calling `setImage` and `setState`.
 */
var Target;
(function (Target) {
    /**
     * Hardware and software should be updated as part of the request.
     */
    Target[Target["HardwareAndSoftware"] = 0] = "HardwareAndSoftware";
    /**
     * Hardware only should be updated as part of the request.
     */
    Target[Target["Hardware"] = 1] = "Hardware";
    /**
     * Software only should be updated as part of the request.
     */
    Target[Target["Software"] = 2] = "Software";
})(Target || (Target = {}));

/**
 * Provides information for a version, as parsed from a string denoted as a collection of numbers separated by a period, for example `1.45.2`, `4.0.2.13098`. Parsing is opinionated
 * and strings should strictly conform to the format `{major}[.{minor}[.{patch}[.{build}]]]`; version numbers that form the version are optional, and when `undefined` will default to
 * 0, for example the `minor`, `patch`, or `build` number may be omitted.
 *
 * NB: This implementation should be considered fit-for-purpose, and should be used sparing.
 */
class Version {
    /**
     * Build version number.
     */
    build;
    /**
     * Major version number.
     */
    major;
    /**
     * Minor version number.
     */
    minor;
    /**
     * Patch version number.
     */
    patch;
    /**
     * Initializes a new instance of the {@link Version} class.
     * @param value Value to parse the version from.
     */
    constructor(value) {
        const result = value.match(/^(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*))?$/);
        if (result === null) {
            throw new Error(`Invalid format; expected "{major}[.{minor}[.{patch}[.{build}]]]" but was "${value}"`);
        }
        [, this.major, this.minor, this.patch, this.build] = [...result.map((value) => parseInt(value) || 0)];
    }
    /**
     * Compares this instance to the {@link other} {@link Version}.
     * @param other The {@link Version} to compare to.
     * @returns `-1` when this instance is less than the {@link other}, `1` when this instance is greater than {@link other}, otherwise `0`.
     */
    compareTo(other) {
        const segments = ({ major, minor, build, patch }) => [major, minor, build, patch];
        const thisSegments = segments(this);
        const otherSegments = segments(other);
        for (let i = 0; i < 4; i++) {
            if (thisSegments[i] < otherSegments[i]) {
                return -1;
            }
            else if (thisSegments[i] > otherSegments[i]) {
                return 1;
            }
        }
        return 0;
    }
    /** @inheritdoc */
    toString() {
        return `${this.major}.${this.minor}`;
    }
}

/**
 * Provides a {@link LogTarget} that logs to the console.
 */
class ConsoleTarget {
    /**
     * @inheritdoc
     */
    write(entry) {
        switch (entry.level) {
            case "error":
                console.error(...entry.data);
                break;
            case "warn":
                console.warn(...entry.data);
                break;
            default:
                console.log(...entry.data);
        }
    }
}

// Remove any dependencies on node.
const EOL = "\n";
/**
 * Creates a new string log entry formatter.
 * @param opts Options that defines the type for the formatter.
 * @returns The string {@link LogEntryFormatter}.
 */
function stringFormatter(opts) {
    {
        return (entry) => {
            const { data, level, scope } = entry;
            let prefix = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} `;
            if (scope) {
                prefix += `${scope}: `;
            }
            return `${prefix}${reduce(data)}`;
        };
    }
}
/**
 * Stringifies the provided data parameters that make up the log entry.
 * @param data Data parameters.
 * @returns The data represented as a single `string`.
 */
function reduce(data) {
    let result = "";
    let previousWasError = false;
    for (const value of data) {
        // When the value is an error, write the stack.
        if (typeof value === "object" && value instanceof Error) {
            result += `${EOL}${value.stack}`;
            previousWasError = true;
            continue;
        }
        // When the previous was an error, write a new line.
        if (previousWasError) {
            result += EOL;
            previousWasError = false;
        }
        result += typeof value === "object" ? JSON.stringify(value) : value;
        result += " ";
    }
    return result.trimEnd();
}

/* eslint-disable @typescript-eslint/sort-type-constituents */
/**
 * Gets the priority of the specified log level as a number; low numbers signify a higher priority.
 * @param level Log level.
 * @returns The priority as a number.
 */
function defcon(level) {
    switch (level) {
        case "error":
            return 0;
        case "warn":
            return 1;
        case "info":
            return 2;
        case "debug":
            return 3;
        case "trace":
        default:
            return 4;
    }
}

/**
 * Logger capable of forwarding messages to a {@link LogTarget}.
 */
class Logger {
    /**
     * Backing field for the {@link Logger.level}.
     */
    #level;
    /**
     * Options that define the loggers behavior.
     */
    #options;
    /**
     * Scope associated with this {@link Logger}.
     */
    #scope;
    /**
     * Initializes a new instance of the {@link Logger} class.
     * @param opts Options that define the loggers behavior.
     */
    constructor(opts) {
        this.#options = { minimumLevel: "trace", ...opts };
        this.#scope = this.#options.scope === undefined || this.#options.scope.trim() === "" ? "" : this.#options.scope;
        if (typeof this.#options.level !== "function") {
            this.setLevel(this.#options.level);
        }
    }
    /**
     * Gets the {@link LogLevel}.
     * @returns The {@link LogLevel}.
     */
    get level() {
        if (this.#level !== undefined) {
            return this.#level;
        }
        return typeof this.#options.level === "function" ? this.#options.level() : this.#options.level;
    }
    /**
     * Creates a scoped logger with the given {@link scope}; logs created by scoped-loggers include their scope to enable their source to be easily identified.
     * @param scope Value that represents the scope of the new logger.
     * @returns The scoped logger, or this instance when {@link scope} is not defined.
     */
    createScope(scope) {
        scope = scope.trim();
        if (scope === "") {
            return this;
        }
        return new Logger({
            ...this.#options,
            level: () => this.level,
            scope: this.#options.scope ? `${this.#options.scope}->${scope}` : scope,
        });
    }
    /**
     * Writes the arguments as a debug log entry.
     * @param data Message or data to log.
     * @returns This instance for chaining.
     */
    debug(...data) {
        return this.write({ level: "debug", data, scope: this.#scope });
    }
    /**
     * Writes the arguments as error log entry.
     * @param data Message or data to log.
     * @returns This instance for chaining.
     */
    error(...data) {
        return this.write({ level: "error", data, scope: this.#scope });
    }
    /**
     * Writes the arguments as an info log entry.
     * @param data Message or data to log.
     * @returns This instance for chaining.
     */
    info(...data) {
        return this.write({ level: "info", data, scope: this.#scope });
    }
    /**
     * Sets the log-level that determines which logs should be written. The specified level will be inherited by all scoped loggers unless they have log-level explicitly defined.
     * @param level The log-level that determines which logs should be written; when `undefined`, the level will be inherited from the parent logger, or default to the environment level.
     * @returns This instance for chaining.
     */
    setLevel(level) {
        if (level !== undefined && defcon(level) > defcon(this.#options.minimumLevel)) {
            this.#level = "info";
        }
        else {
            this.#level = level;
        }
        return this;
    }
    /**
     * Writes the arguments as a trace log entry.
     * @param data Message or data to log.
     * @returns This instance for chaining.
     */
    trace(...data) {
        return this.write({ level: "trace", data, scope: this.#scope });
    }
    /**
     * Writes the arguments as a warning log entry.
     * @param data Message or data to log.
     * @returns This instance for chaining.
     */
    warn(...data) {
        return this.write({ level: "warn", data, scope: this.#scope });
    }
    /**
     * Writes the log entry.
     * @param entry Log entry to write.
     * @returns This instance for chaining.
     */
    write(entry) {
        if (defcon(entry.level) <= defcon(this.level)) {
            this.#options.targets.forEach((t) => t.write(entry));
        }
        return this;
    }
}

/**
 * Provides a {@link LogTarget} capable of logging to a local file system.
 */
class FileTarget {
    /**
     * File path where logs will be written.
     */
    #filePath;
    /**
     * Options that defines how logs should be written to the local file system.
     */
    #options;
    /**
     * Current size of the logs that have been written to the {@link FileTarget.#filePath}.
     */
    #size = 0;
    /**
     * Initializes a new instance of the {@link FileTarget} class.
     * @param options Options that defines how logs should be written to the local file system.
     */
    constructor(options) {
        this.#options = options;
        this.#filePath = this.getLogFilePath();
        this.reIndex();
    }
    /**
     * @inheritdoc
     */
    write(entry) {
        const fd = fs.openSync(this.#filePath, "a");
        try {
            const msg = this.#options.format(entry);
            fs.writeSync(fd, msg + "\n");
            this.#size += msg.length;
        }
        finally {
            fs.closeSync(fd);
        }
        if (this.#size >= this.#options.maxSize) {
            this.reIndex();
            this.#size = 0;
        }
    }
    /**
     * Gets the file path to an indexed log file.
     * @param index Optional index of the log file to be included as part of the file name.
     * @returns File path that represents the indexed log file.
     */
    getLogFilePath(index = 0) {
        return path.join(this.#options.dest, `${this.#options.fileName}.${index}.log`);
    }
    /**
     * Gets the log files associated with this file target, including past and present.
     * @returns Log file entries.
     */
    getLogFiles() {
        const regex = /^\.(\d+)\.log$/;
        return fs
            .readdirSync(this.#options.dest, { withFileTypes: true })
            .reduce((prev, entry) => {
            if (entry.isDirectory() || entry.name.indexOf(this.#options.fileName) < 0) {
                return prev;
            }
            const match = entry.name.substring(this.#options.fileName.length).match(regex);
            if (match?.length !== 2) {
                return prev;
            }
            prev.push({
                path: path.join(this.#options.dest, entry.name),
                index: parseInt(match[1]),
            });
            return prev;
        }, [])
            .sort(({ index: a }, { index: b }) => {
            return a < b ? -1 : a > b ? 1 : 0;
        });
    }
    /**
     * Re-indexes the existing log files associated with this file target, removing old log files whose index exceeds the {@link FileTargetOptions.maxFileCount}, and renaming the
     * remaining log files, leaving index "0" free for a new log file.
     */
    reIndex() {
        // When the destination directory is new, create it, and return.
        if (!fs.existsSync(this.#options.dest)) {
            fs.mkdirSync(this.#options.dest);
            return;
        }
        const logFiles = this.getLogFiles();
        for (let i = logFiles.length - 1; i >= 0; i--) {
            const log = logFiles[i];
            if (i >= this.#options.maxFileCount - 1) {
                fs.rmSync(log.path);
            }
            else {
                fs.renameSync(log.path, this.getLogFilePath(i + 1));
            }
        }
    }
}

let __isDebugMode = undefined;
/**
 * Determines whether the current plugin is running in a debug environment; this is determined by the command-line arguments supplied to the plugin by Stream. Specifically, the result
 * is `true` when  either `--inspect`, `--inspect-brk` or `--inspect-port` are present as part of the processes' arguments.
 * @returns `true` when the plugin is running in debug mode; otherwise `false`.
 */
function isDebugMode() {
    if (__isDebugMode === undefined) {
        __isDebugMode = process.execArgv.some((arg) => {
            const name = arg.split("=")[0];
            return name === "--inspect" || name === "--inspect-brk" || name === "--inspect-port";
        });
    }
    return __isDebugMode;
}
/**
 * Gets the plugin's unique-identifier from the current working directory.
 * @returns The plugin's unique-identifier.
 */
function getPluginUUID() {
    const name = path.basename(process.cwd());
    const suffixIndex = name.lastIndexOf(".sdPlugin");
    return suffixIndex < 0 ? name : name.substring(0, suffixIndex);
}

// Log all entires to a log file.
const fileTarget = new FileTarget({
    dest: path.join(node_process.cwd(), "logs"),
    fileName: getPluginUUID(),
    format: stringFormatter(),
    maxFileCount: 10,
    maxSize: 50 * 1024 * 1024,
});
// Construct the log targets.
const targets = [fileTarget];
if (isDebugMode()) {
    targets.splice(0, 0, new ConsoleTarget());
}
/**
 * Logger responsible for capturing log messages.
 */
const logger = new Logger({
    level: isDebugMode() ? "debug" : "info",
    minimumLevel: isDebugMode() ? "trace" : "debug",
    targets,
});
process.once("uncaughtException", (err) => logger.error("Process encountered uncaught exception", err));

/**
 * Provides a connection between the plugin and the Stream Deck allowing for messages to be sent and received.
 */
class Connection extends EventEmitter$1 {
    /**
     * Private backing field for {@link Connection.registrationParameters}.
     */
    _registrationParameters;
    /**
     * Private backing field for {@link Connection.version}.
     */
    _version;
    /**
     * Used to ensure {@link Connection.connect} is invoked as a singleton; `false` when a connection is occurring or established.
     */
    canConnect = true;
    /**
     * Underlying web socket connection.
     */
    connection = withResolvers();
    /**
     * Logger scoped to the connection.
     */
    logger = logger.createScope("Connection");
    /**
     * Underlying connection information provided to the plugin to establish a connection with Stream Deck.
     * @returns The registration parameters.
     */
    get registrationParameters() {
        return (this._registrationParameters ??= this.getRegistrationParameters());
    }
    /**
     * Version of Stream Deck this instance is connected to.
     * @returns The version.
     */
    get version() {
        return (this._version ??= new Version(this.registrationParameters.info.application.version));
    }
    /**
     * Establishes a connection with the Stream Deck, allowing for the plugin to send and receive messages.
     * @returns A promise that is resolved when a connection has been established.
     */
    async connect() {
        // Ensure we only establish a single connection.
        if (this.canConnect) {
            this.canConnect = false;
            const webSocket = new WebSocket$1(`ws://127.0.0.1:${this.registrationParameters.port}`);
            webSocket.onmessage = (ev) => this.tryEmit(ev);
            webSocket.onopen = () => {
                webSocket.send(JSON.stringify({
                    event: this.registrationParameters.registerEvent,
                    uuid: this.registrationParameters.pluginUUID,
                }));
                // Web socket established a connection with the Stream Deck and the plugin was registered.
                this.connection.resolve(webSocket);
                this.emit("connected", this.registrationParameters.info);
            };
        }
        await this.connection.promise;
    }
    /**
     * Sends the commands to the Stream Deck, once the connection has been established and registered.
     * @param command Command being sent.
     * @returns `Promise` resolved when the command is sent to Stream Deck.
     */
    async send(command) {
        const connection = await this.connection.promise;
        const message = JSON.stringify(command);
        this.logger.trace(message);
        connection.send(message);
    }
    /**
     * Gets the registration parameters, provided by Stream Deck, that provide information to the plugin, including how to establish a connection.
     * @returns Parsed registration parameters.
     */
    getRegistrationParameters() {
        const params = {
            port: undefined,
            info: undefined,
            pluginUUID: undefined,
            registerEvent: undefined,
        };
        const scopedLogger = logger.createScope("RegistrationParameters");
        for (let i = 0; i < process.argv.length - 1; i++) {
            const param = process.argv[i];
            const value = process.argv[++i];
            switch (param) {
                case RegistrationParameter.Port:
                    scopedLogger.debug(`port=${value}`);
                    params.port = value;
                    break;
                case RegistrationParameter.PluginUUID:
                    scopedLogger.debug(`pluginUUID=${value}`);
                    params.pluginUUID = value;
                    break;
                case RegistrationParameter.RegisterEvent:
                    scopedLogger.debug(`registerEvent=${value}`);
                    params.registerEvent = value;
                    break;
                case RegistrationParameter.Info:
                    scopedLogger.debug(`info=${value}`);
                    params.info = JSON.parse(value);
                    break;
                default:
                    i--;
                    break;
            }
        }
        const invalidArgs = [];
        const validate = (name, value) => {
            if (value === undefined) {
                invalidArgs.push(name);
            }
        };
        validate(RegistrationParameter.Port, params.port);
        validate(RegistrationParameter.PluginUUID, params.pluginUUID);
        validate(RegistrationParameter.RegisterEvent, params.registerEvent);
        validate(RegistrationParameter.Info, params.info);
        if (invalidArgs.length > 0) {
            throw new Error(`Unable to establish a connection with Stream Deck, missing command line arguments: ${invalidArgs.join(", ")}`);
        }
        return params;
    }
    /**
     * Attempts to emit the {@link ev} that was received from the {@link Connection.connection}.
     * @param ev Event message data received from Stream Deck.
     */
    tryEmit(ev) {
        try {
            const message = JSON.parse(ev.data.toString());
            if (message.event) {
                this.logger.trace(ev.data.toString());
                this.emit(message.event, message);
            }
            else {
                this.logger.warn(`Received unknown message: ${ev.data}`);
            }
        }
        catch (err) {
            this.logger.error(`Failed to parse message: ${ev.data}`, err);
        }
    }
}
const connection = new Connection();

/**
 * Provides information for events received from Stream Deck.
 */
class Event {
    /**
     * Event that occurred.
     */
    type;
    /**
     * Initializes a new instance of the {@link Event} class.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(source) {
        this.type = source.event;
    }
}

/**
 * Provides information for an event relating to an action.
 */
class ActionWithoutPayloadEvent extends Event {
    action;
    /**
     * Initializes a new instance of the {@link ActionWithoutPayloadEvent} class.
     * @param action Action that raised the event.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(action, source) {
        super(source);
        this.action = action;
    }
}
/**
 * Provides information for an event relating to an action.
 */
class ActionEvent extends ActionWithoutPayloadEvent {
    /**
     * Provides additional information about the event that occurred, e.g. how many `ticks` the dial was rotated, the current `state` of the action, etc.
     */
    payload;
    /**
     * Initializes a new instance of the {@link ActionEvent} class.
     * @param action Action that raised the event.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(action, source) {
        super(action, source);
        this.payload = source.payload;
    }
}

const manifest$1 = new Lazy(() => {
    const path$1 = path.join(process.cwd(), "manifest.json");
    if (!fs.existsSync(path$1)) {
        throw new Error("Failed to read manifest.json as the file does not exist.");
    }
    try {
        return JSON.parse(fs.readFileSync(path$1, {
            encoding: "utf-8",
            flag: "r",
        }).toString());
    }
    catch (e) {
        if (e instanceof SyntaxError) {
            return null;
        }
        else {
            throw e;
        }
    }
});
const softwareMinimumVersion = new Lazy(() => {
    if (manifest$1.value === null) {
        return null;
    }
    return new Version(manifest$1.value.Software.MinimumVersion);
});
/**
 * Gets the SDK version that the plugin requires.
 * @returns SDK version; otherwise `null` when the plugin is DRM protected.
 */
function getSDKVersion() {
    return manifest$1.value?.SDKVersion ?? null;
}
/**
 * Gets the minimum version that the plugin requires.
 * @returns Minimum required version; otherwise `null` when the plugin is DRM protected.
 */
function getSoftwareMinimumVersion() {
    return softwareMinimumVersion.value;
}
/**
 * Gets the manifest associated with the plugin.
 * @returns The manifest; otherwise `null` when the plugin is DRM protected.
 */
function getManifest() {
    return manifest$1.value;
}

/**
 * Configuration shared by action components that must not depend on the plugin settings module.
 */
const actionConfig = {
    /**
     * Determines whether settings requests should use message identifiers and action settings cache behavior.
     */
    useExperimentalMessageIdentifiers: false,
};

const __items$1 = new Map();
/**
 * Provides a read-only store of Stream Deck devices.
 */
class ReadOnlyActionStore extends Enumerable {
    /**
     * Initializes a new instance of the {@link ReadOnlyActionStore}.
     */
    constructor() {
        super(__items$1);
    }
    /**
     * Gets the action with the specified identifier.
     * @param id Identifier of action to search for.
     * @returns The action, when present; otherwise `undefined`.
     */
    getActionById(id) {
        return __items$1.get(id);
    }
}
/**
 * Provides a store of Stream Deck actions.
 */
class ActionStore extends ReadOnlyActionStore {
    /**
     * Deletes the action from the store.
     * @param id The action's identifier.
     */
    delete(id) {
        __items$1.delete(id);
    }
    /**
     * Adds the action to the store.
     * @param action The action.
     */
    set(action) {
        __items$1.set(action.id, action);
    }
}
/**
 * Singleton instance of the action store.
 */
const actionStore = new ActionStore();

/**
 * Provides information for events relating to an application.
 */
class ApplicationEvent extends Event {
    /**
     * Monitored application that was launched/terminated.
     */
    application;
    /**
     * Initializes a new instance of the {@link ApplicationEvent} class.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(source) {
        super(source);
        this.application = source.payload.application;
    }
}

/**
 * Provides information for events relating to a device.
 */
class DeviceEvent extends Event {
    device;
    /**
     * Initializes a new instance of the {@link DeviceEvent} class.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     * @param device Device that event is associated with.
     */
    constructor(source, device) {
        super(source);
        this.device = device;
    }
}

/**
 * Event information received from Stream Deck as part of a deep-link message being routed to the plugin.
 */
class DidReceiveDeepLinkEvent extends Event {
    /**
     * Deep-link URL routed from Stream Deck.
     */
    url;
    /**
     * Initializes a new instance of the {@link DidReceiveDeepLinkEvent} class.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(source) {
        super(source);
        this.url = new DeepLinkURL(source.payload.url);
    }
}
const PREFIX = "streamdeck://";
/**
 * Provides information associated with a URL received as part of a deep-link message, conforming to the URI syntax defined within RFC-3986 (https://datatracker.ietf.org/doc/html/rfc3986#section-3).
 */
class DeepLinkURL {
    /**
     * Fragment of the URL, with the number sign (#) omitted. For example, a URL of "/test#heading" would result in a {@link DeepLinkURL.fragment} of "heading".
     */
    fragment;
    /**
     * Original URL. For example, a URL of "/test?one=two#heading" would result in a {@link DeepLinkURL.href} of "/test?one=two#heading".
     */
    href;
    /**
     * Path of the URL; the full URL with the query and fragment omitted. For example, a URL of "/test?one=two#heading" would result in a {@link DeepLinkURL.path} of "/test".
     */
    path;
    /**
     * Query of the URL, with the question mark (?) omitted. For example, a URL of "/test?name=elgato&key=123" would result in a {@link DeepLinkURL.query} of "name=elgato&key=123".
     * See also {@link DeepLinkURL.queryParameters}.
     */
    query;
    /**
     * Query string parameters parsed from the URL. See also {@link DeepLinkURL.query}.
     */
    queryParameters;
    /**
     * Initializes a new instance of the {@link DeepLinkURL} class.
     * @param url URL of the deep-link, with the schema and authority omitted.
     */
    constructor(url) {
        const refUrl = new URL(`${PREFIX}${url}`);
        this.fragment = refUrl.hash.substring(1);
        this.href = refUrl.href.substring(PREFIX.length);
        this.path = DeepLinkURL.parsePath(this.href);
        this.query = refUrl.search.substring(1);
        this.queryParameters = refUrl.searchParams;
    }
    /**
     * Parses the {@link DeepLinkURL.path} from the specified {@link href}.
     * @param href Partial URL that contains the path to parse.
     * @returns The path of the URL.
     */
    static parsePath(href) {
        const indexOf = (char) => {
            const index = href.indexOf(char);
            return index >= 0 ? index : href.length;
        };
        return href.substring(0, Math.min(indexOf("?"), indexOf("#")));
    }
}

/**
 * Provides event information for when the plugin received the global settings.
 */
class DidReceiveGlobalSettingsEvent extends Event {
    /**
     * Settings associated with the event.
     */
    settings;
    /**
     * Initializes a new instance of the {@link DidReceiveGlobalSettingsEvent} class.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(source) {
        super(source);
        this.settings = source.payload.settings;
    }
}

/**
 * Provides information for an event triggered by a message being sent to the plugin, from the property inspector.
 */
class SendToPluginEvent extends Event {
    action;
    /**
     * Payload sent from the property inspector.
     */
    payload;
    /**
     * Initializes a new instance of the {@link SendToPluginEvent} class.
     * @param action Action that raised the event.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(action, source) {
        super(source);
        this.action = action;
        this.payload = source.payload;
    }
}

/**
 * Validates the `SDKVersion` within the manifest fulfils the minimum required version for the specified
 * feature; when the version is not fulfilled, an error is thrown with the feature formatted into the message.
 * @param minimumVersion Minimum required SDKVersion.
 * @param feature Feature that requires the version.
 */
function requiresSDKVersion(minimumVersion, feature) {
    const sdkVersion = getSDKVersion();
    if (sdkVersion !== null && minimumVersion > sdkVersion) {
        throw new Error(`[ERR_NOT_SUPPORTED]: ${feature} requires manifest SDK version ${minimumVersion} or higher, but found version ${sdkVersion}; please update the "SDKVersion" in the plugin's manifest to ${minimumVersion} or higher.`);
    }
}
/**
 * Validates the {@link streamDeckVersion} and manifest's `Software.MinimumVersion` are at least the {@link minimumVersion};
 * when the version is not fulfilled, an error is thrown with the {@link feature} formatted into the message.
 * @param minimumVersion Minimum required version.
 * @param streamDeckVersion Actual application version.
 * @param feature Feature that requires the version.
 */
function requiresVersion(minimumVersion, streamDeckVersion, feature) {
    const required = {
        major: Math.floor(minimumVersion),
        minor: Number(minimumVersion.toString().split(".").at(1) ?? 0), // Account for JavaScript's floating point precision.
        patch: 0,
        build: 0,
    };
    if (streamDeckVersion.compareTo(required) === -1) {
        throw new Error(`[ERR_NOT_SUPPORTED]: ${feature} requires Stream Deck version ${required.major}.${required.minor} or higher, but current version is ${streamDeckVersion.major}.${streamDeckVersion.minor}; please update Stream Deck and the "Software.MinimumVersion" in the plugin's manifest to "${required.major}.${required.minor}" or higher.`);
    }
    const softwareMinimumVersion = getSoftwareMinimumVersion();
    if (softwareMinimumVersion !== null && softwareMinimumVersion.compareTo(required) === -1) {
        throw new Error(`[ERR_NOT_SUPPORTED]: ${feature} requires Stream Deck version ${required.major}.${required.minor} or higher; please update the "Software.MinimumVersion" in the plugin's manifest to "${required.major}.${required.minor}" or higher.`);
    }
}

const settings = {
    /**
     * Available from Stream Deck 7.1; determines whether message identifiers should be sent when getting
     * action-instance or global settings.
     *
     * When `true`, the did-receive events associated with settings are only emitted when the action-instance
     * or global settings are changed in the property inspector.
     * @returns The value.
     */
    get useExperimentalMessageIdentifiers() {
        return actionConfig.useExperimentalMessageIdentifiers;
    },
    /**
     * Available from Stream Deck 7.1; determines whether message identifiers should be sent when getting
     * action-instance or global settings.
     *
     * When `true`, the did-receive events associated with settings are only emitted when the action-instance
     * or global settings are changed in the property inspector.
     */
    set useExperimentalMessageIdentifiers(value) {
        requiresVersion(7.1, connection.version, "Message identifiers");
        actionConfig.useExperimentalMessageIdentifiers = value;
    },
    /**
     * Gets the global settings associated with the plugin.
     * @template T The type of global settings associated with the plugin.
     * @returns Promise containing the plugin's global settings.
     */
    getGlobalSettings: () => {
        return new Promise((resolve) => {
            connection.once("didReceiveGlobalSettings", (ev) => resolve(ev.payload.settings));
            connection.send({
                event: "getGlobalSettings",
                context: connection.registrationParameters.pluginUUID,
                id: node_crypto.randomUUID(),
            });
        });
    },
    /**
     * Occurs when the global settings are requested, or when the the global settings were updated in
     * the property inspector.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that removes the listener.
     */
    onDidReceiveGlobalSettings: (listener) => {
        return connection.disposableOn("didReceiveGlobalSettings", (ev) => {
            // Do nothing when the global settings were requested.
            if (settings.useExperimentalMessageIdentifiers && ev.id) {
                return;
            }
            listener(new DidReceiveGlobalSettingsEvent(ev));
        });
    },
    /**
     * Occurs when the settings associated with an action instance are requested, or when the the settings
     * were updated in the property inspector.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that removes the listener.
     */
    onDidReceiveSettings: (listener) => {
        return connection.disposableOn("didReceiveSettings", (ev) => {
            // Do nothing when the action's settings were requested.
            if (settings.useExperimentalMessageIdentifiers && ev.id) {
                return;
            }
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new ActionEvent(action, ev));
            }
        });
    },
    /**
     * Sets the global settings associated the plugin; these settings are only available to this plugin,
     * and should be used to persist information securely.
     * @param settings Settings to save.
     * @example
     * streamDeck.settings.setGlobalSettings({
     *   apiKey,
     *   connectedDate: new Date()
     * })
     */
    setGlobalSettings: async (settings) => {
        await connection.send({
            event: "setGlobalSettings",
            context: connection.registrationParameters.pluginUUID,
            payload: settings,
        });
    },
};

/**
 * Controller capable of sending/receiving payloads with the property inspector, and listening for events.
 */
class UIController {
    /**
     * Action associated with the current property inspector.
     */
    #action;
    /**
     * To overcome event races, the debounce counter keeps track of appear vs disappear events, ensuring
     * we only clear the current ui when an equal number of matching disappear events occur.
     */
    #appearanceStackCount = 0;
    /**
     * Initializes a new instance of the {@link UIController} class.
     */
    constructor() {
        // Track the action for the current property inspector.
        this.onDidAppear((ev) => {
            if (this.#isCurrent(ev.action)) {
                this.#appearanceStackCount++;
            }
            else {
                this.#appearanceStackCount = 1;
                this.#action = ev.action;
            }
        });
        this.onDidDisappear((ev) => {
            if (this.#isCurrent(ev.action)) {
                this.#appearanceStackCount--;
                if (this.#appearanceStackCount <= 0) {
                    this.#action = undefined;
                }
            }
        });
    }
    /**
     * Gets the action associated with the current property.
     * @returns The action; otherwise `undefined` when a property inspector is not visible.
     */
    get action() {
        return this.#action;
    }
    /**
     * Occurs when the property inspector associated with the action becomes visible, i.e. the user
     * selected an action in the Stream Deck application..
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDidAppear(listener) {
        return connection.disposableOn("propertyInspectorDidAppear", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new ActionWithoutPayloadEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the property inspector associated with the action disappears, i.e. the user unselected
     * the action in the Stream Deck application.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDidDisappear(listener) {
        return connection.disposableOn("propertyInspectorDidDisappear", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new ActionWithoutPayloadEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when a message was sent to the plugin _from_ the property inspector.
     * @template TPayload The type of the payload received from the property inspector.
     * @template TSettings The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onSendToPlugin(listener) {
        return connection.disposableOn("sendToPlugin", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new SendToPluginEvent(action, ev));
            }
        });
    }
    /**
     * Sends the payload to the property inspector; the payload is only sent when the property inspector
     * is visible for an action provided by this plugin.
     * @param payload Payload to send.
     */
    async sendToPropertyInspector(payload) {
        if (this.#action) {
            await connection.send({
                event: "sendToPropertyInspector",
                context: this.#action.id,
                payload,
            });
        }
    }
    /**
     * Determines whether the specified action is the action for the current property inspector.
     * @param action Action to check against.
     * @returns `true` when the actions are the same.
     */
    #isCurrent(action) {
        return (this.#action?.id === action.id &&
            this.#action?.manifestId === action.manifestId &&
            this.#action?.device?.id === action.device.id);
    }
}
const ui = new UIController();

/**
 * Provides a cache for action settings, keyed by action instance identifier.
 */
class SettingsCache {
    /**
     * Underlying map of action ID to cached settings.
     */
    #entries = new Map();
    /**
     * Removes the cached settings for the specified action.
     * @param id Action instance identifier.
     */
    delete(id) {
        this.#entries.delete(id);
    }
    /**
     * Gets the cached settings for the specified action.
     * @param id Action instance identifier.
     * @returns The cached settings when present; otherwise `undefined`.
     */
    get(id) {
        const settings = this.#entries.get(id);
        return settings !== undefined ? structuredClone(settings) : undefined;
    }
    /**
     * Sets the cached settings for the specified action.
     * @param id Action instance identifier.
     * @param settings The settings to cache.
     */
    set(id, settings) {
        this.#entries.set(id, structuredClone(settings));
    }
}
/**
 * Singleton instance of the settings cache.
 */
const settingsCache = new SettingsCache();

const __items = new Map();
/**
 * Provides a read-only store of Stream Deck devices.
 */
class ReadOnlyDeviceStore extends Enumerable {
    /**
     * Initializes a new instance of the {@link ReadOnlyDeviceStore}.
     */
    constructor() {
        super(__items);
    }
    /**
     * Gets the Stream Deck {@link Device} associated with the specified {@link deviceId}.
     * @param deviceId Identifier of the Stream Deck device.
     * @returns The Stream Deck device information; otherwise `undefined` if a device with the {@link deviceId} does not exist.
     */
    getDeviceById(deviceId) {
        return __items.get(deviceId);
    }
}
/**
 * Provides a store of Stream Deck devices.
 */
class DeviceStore extends ReadOnlyDeviceStore {
    /**
     * Adds the device to the store.
     * @param device The device.
     */
    set(device) {
        __items.set(device.id, device);
    }
}
/**
 * Singleton instance of the device store.
 */
const deviceStore = new DeviceStore();

/**
 * Provides information about an instance of a Stream Deck action.
 */
class ActionContext {
    /**
     * Device the action is associated with.
     */
    #device;
    /**
     * Source of the action.
     */
    #source;
    /**
     * Initializes a new instance of the {@link ActionContext} class.
     * @param source Source of the action.
     */
    constructor(source) {
        this.#source = source;
        const device = deviceStore.getDeviceById(source.device);
        if (!device) {
            throw new Error(`Failed to initialize action; device ${source.device} not found`);
        }
        this.#device = device;
    }
    /**
     * Type of the action.
     * - `Keypad` is a key.
     * - `Encoder` is a dial and portion of the touch strip.
     * @returns Controller type.
     */
    get controllerType() {
        return this.#source.payload.controller;
    }
    /**
     * Stream Deck device the action is positioned on.
     * @returns Stream Deck device.
     */
    get device() {
        return this.#device;
    }
    /**
     * Action instance identifier.
     * @returns Identifier.
     */
    get id() {
        return this.#source.context;
    }
    /**
     * Manifest identifier (UUID) for this action type.
     * @returns Manifest identifier.
     */
    get manifestId() {
        return this.#source.action;
    }
    /**
     * Converts this instance to a serializable object.
     * @returns The serializable object.
     */
    toJSON() {
        return {
            controllerType: this.controllerType,
            device: this.device,
            id: this.id,
            manifestId: this.manifestId,
        };
    }
}

const REQUEST_TIMEOUT = 15 * 1000; // 15s
/**
 * Provides a contextualized instance of an {@link Action}, allowing for direct communication with the Stream Deck.
 * @template T The type of settings associated with the action.
 */
class Action extends ActionContext {
    /**
     * Gets the resources (files) associated with this action; these resources are embedded into the
     * action when it is exported, either individually, or as part of a profile.
     *
     * Available from Stream Deck 7.1.
     * @returns The resources.
     */
    async getResources() {
        requiresVersion(7.1, connection.version, "getResources");
        const res = await this.#fetch("getResources", "didReceiveResources");
        return res.payload.resources;
    }
    /**
     * Gets the settings associated this action instance.
     * @template U The type of settings associated with the action.D
     * @returns Promise containing the action instance's settings.
     */
    async getSettings() {
        if (actionConfig.useExperimentalMessageIdentifiers) {
            const cached = settingsCache.get(this.id);
            if (cached !== undefined) {
                logger.trace(JSON.stringify({
                    event: "getSettings",
                    context: this.id,
                    source: "cache",
                    settings: cached,
                }));
                return cached;
            }
        }
        const res = await this.#fetch("getSettings", "didReceiveSettings");
        return res.payload.settings;
    }
    /**
     * Determines whether this instance is a dial.
     * @returns `true` when this instance is a dial; otherwise `false`.
     */
    isDial() {
        return this.controllerType === "Encoder";
    }
    /**
     * Determines whether this instance is a key.
     * @returns `true` when this instance is a key; otherwise `false`.
     */
    isKey() {
        return this.controllerType === "Keypad";
    }
    /**
     * Sets the resources (files) associated with this action; these resources are embedded into the
     * action when it is exported, either individually, or as part of a profile.
     *
     * Available from Stream Deck 7.1.
     * @example
     * action.setResources({
     *   fileOne: "c:\\hello-world.txt",
     *   anotherFile: "c:\\icon.png"
     * });
     * @param resources The resources as a map of file paths.
     * @returns `Promise` resolved when the resources are saved to Stream Deck.
     */
    setResources(resources) {
        requiresVersion(7.1, connection.version, "setResources");
        return connection.send({
            event: "setResources",
            context: this.id,
            payload: resources,
        });
    }
    /**
     * Sets the settings associated with this action instance. Use in conjunction with {@link Action.getSettings}.
     * @param value Settings to persist.
     * @returns `Promise` resolved when the settings are sent to Stream Deck.
     */
    setSettings(value) {
        settingsCache.delete(this.id);
        return connection.send({
            event: "setSettings",
            context: this.id,
            payload: value,
        });
    }
    /**
     * Temporarily shows an alert (i.e. warning), in the form of an exclamation mark in a yellow triangle, on this action instance. Used to provide visual feedback when an action failed.
     * @returns `Promise` resolved when the request to show an alert has been sent to Stream Deck.
     */
    showAlert() {
        return connection.send({
            event: "showAlert",
            context: this.id,
        });
    }
    /**
     * Fetches information from Stream Deck by sending the command, and awaiting the event.
     * @param command Name of the event (command) to send.
     * @param event Name of the event to await.
     * @returns The payload from the received event.
     */
    async #fetch(command, event) {
        const { resolve, reject, promise } = withResolvers();
        // Set a timeout to prevent endless awaiting.
        const timeoutId = setTimeout(() => {
            listener.dispose();
            reject("The request timed out");
        }, REQUEST_TIMEOUT);
        // Listen for an event that can resolve the request.
        const listener = connection.disposableOn(event, (ev) => {
            // Make sure the received event is for this action.
            if (ev.context == this.id) {
                clearTimeout(timeoutId);
                listener.dispose();
                resolve(ev);
            }
        });
        // Send the request; specifying an id signifies its a request.
        await connection.send({
            event: command,
            context: this.id,
            id: node_crypto.randomUUID(),
        });
        return promise;
    }
}

/**
 * Provides a contextualized instance of a dial action.
 * @template T The type of settings associated with the action.
 */
class DialAction extends Action {
    /**
     * Private backing field for {@link DialAction.coordinates}.
     */
    #coordinates;
    /**
     * Initializes a new instance of the {@see DialAction} class.
     * @param source Source of the action.
     */
    constructor(source) {
        super(source);
        if (source.payload.controller !== "Encoder") {
            throw new Error("Unable to create DialAction; source event is not a Encoder");
        }
        this.#coordinates = Object.freeze(source.payload.coordinates);
    }
    /**
     * Coordinates of the dial.
     * @returns The coordinates.
     */
    get coordinates() {
        return this.#coordinates;
    }
    /**
     * Sets the feedback for the current layout associated with this action instance, allowing for the visual items to be updated. Layouts are a powerful way to provide dynamic information
     * to users, and can be assigned in the manifest, or dynamically via {@link Action.setFeedbackLayout}.
     *
     * The {@link feedback} payload defines which items within the layout will be updated, and are identified by their property name (defined as the `key` in the layout's definition).
     * The values can either by a complete new definition, a `string` for layout item types of `text` and `pixmap`, or a `number` for layout item types of `bar` and `gbar`.
     * @param feedback Object containing information about the layout items to be updated.
     * @returns `Promise` resolved when the request to set the {@link feedback} has been sent to Stream Deck.
     */
    setFeedback(feedback) {
        return connection.send({
            event: "setFeedback",
            context: this.id,
            payload: feedback,
        });
    }
    /**
     * Sets the layout associated with this action instance. The layout must be either a built-in layout identifier, or path to a local layout JSON file within the plugin's folder.
     * Use in conjunction with {@link Action.setFeedback} to update the layout's current items' settings.
     * @param layout Name of a pre-defined layout, or relative path to a custom one.
     * @returns `Promise` resolved when the new layout has been sent to Stream Deck.
     */
    setFeedbackLayout(layout) {
        return connection.send({
            event: "setFeedbackLayout",
            context: this.id,
            payload: {
                layout,
            },
        });
    }
    /**
     * Sets the {@link image} to be display for this action instance within Stream Deck app.
     *
     * NB: The image can only be set by the plugin when the the user has not specified a custom image.
     * @param image Image to display; this can be either a path to a local file within the plugin's folder, a base64 encoded `string` with the mime type declared (e.g. PNG, JPEG, etc.),
     * or an SVG `string`. When `undefined`, the image from the manifest will be used.
     * @returns `Promise` resolved when the request to set the {@link image} has been sent to Stream Deck.
     */
    setImage(image) {
        return connection.send({
            event: "setImage",
            context: this.id,
            payload: {
                image,
            },
        });
    }
    /**
     * Sets the {@link title} displayed for this action instance.
     *
     * NB: The title can only be set by the plugin when the the user has not specified a custom title.
     * @param title Title to display.
     * @returns `Promise` resolved when the request to set the {@link title} has been sent to Stream Deck.
     */
    setTitle(title) {
        return this.setFeedback({ title });
    }
    /**
     * Sets the trigger (interaction) {@link descriptions} associated with this action instance. Descriptions are shown within the Stream Deck application, and informs the user what
     * will happen when they interact with the action, e.g. rotate, touch, etc. When {@link descriptions} is `undefined`, the descriptions will be reset to the values provided as part
     * of the manifest.
     *
     * NB: Applies to encoders (dials / touchscreens) found on Stream Deck + devices.
     * @param descriptions Descriptions that detail the action's interaction.
     * @returns `Promise` resolved when the request to set the {@link descriptions} has been sent to Stream Deck.
     */
    setTriggerDescription(descriptions) {
        return connection.send({
            event: "setTriggerDescription",
            context: this.id,
            payload: descriptions || {},
        });
    }
    /**
     * @inheritdoc
     */
    toJSON() {
        return {
            ...super.toJSON(),
            coordinates: this.coordinates,
        };
    }
}

/**
 * Provides a contextualized instance of a key action.
 * @template T The type of settings associated with the action.
 */
class KeyAction extends Action {
    /**
     * Private backing field for {@link KeyAction.coordinates}.
     */
    #coordinates;
    /**
     * Source of the action.
     */
    #source;
    /**
     * Initializes a new instance of the {@see KeyAction} class.
     * @param source Source of the action.
     */
    constructor(source) {
        super(source);
        if (source.payload.controller !== "Keypad") {
            throw new Error("Unable to create KeyAction; source event is not a Keypad");
        }
        this.#coordinates = !source.payload.isInMultiAction ? Object.freeze(source.payload.coordinates) : undefined;
        this.#source = source;
    }
    /**
     * Coordinates of the key; otherwise `undefined` when the action is part of a multi-action.
     * @returns The coordinates.
     */
    get coordinates() {
        return this.#coordinates;
    }
    /**
     * Determines whether the key is part of a multi-action.
     * @returns `true` when in a multi-action; otherwise `false`.
     */
    isInMultiAction() {
        return this.#source.payload.isInMultiAction;
    }
    /**
     * Sets the {@link image} to be display for this action instance.
     *
     * NB: The image can only be set by the plugin when the the user has not specified a custom image.
     * @param image Image to display; this can be either a path to a local file within the plugin's folder, a base64 encoded `string` with the mime type declared (e.g. PNG, JPEG, etc.),
     * or an SVG `string`. When `undefined`, the image from the manifest will be used.
     * @param options Additional options that define where and how the image should be rendered.
     * @returns `Promise` resolved when the request to set the {@link image} has been sent to Stream Deck.
     */
    setImage(image, options) {
        return connection.send({
            event: "setImage",
            context: this.id,
            payload: {
                image,
                ...options,
            },
        });
    }
    /**
     * Sets the current {@link state} of this action instance; only applies to actions that have multiple states defined within the manifest.
     * @param state State to set; this be either 0, or 1.
     * @returns `Promise` resolved when the request to set the state of an action instance has been sent to Stream Deck.
     */
    setState(state) {
        return connection.send({
            event: "setState",
            context: this.id,
            payload: {
                state,
            },
        });
    }
    /**
     * Sets the {@link title} displayed for this action instance.
     *
     * NB: The title can only be set by the plugin when the the user has not specified a custom title.
     * @param title Title to display; when `undefined` the title within the manifest will be used.
     * @param options Additional options that define where and how the title should be rendered.
     * @returns `Promise` resolved when the request to set the {@link title} has been sent to Stream Deck.
     */
    setTitle(title, options) {
        return connection.send({
            event: "setTitle",
            context: this.id,
            payload: {
                title,
                ...options,
            },
        });
    }
    /**
     * Temporarily shows an "OK" (i.e. success), in the form of a check-mark in a green circle, on this action instance. Used to provide visual feedback when an action successfully
     * executed.
     * @returns `Promise` resolved when the request to show an "OK" has been sent to Stream Deck.
     */
    showOk() {
        return connection.send({
            event: "showOk",
            context: this.id,
        });
    }
    /**
     * @inheritdoc
     */
    toJSON() {
        return {
            ...super.toJSON(),
            coordinates: this.coordinates,
            isInMultiAction: this.isInMultiAction(),
        };
    }
}

const manifest = new Lazy(() => getManifest());
/**
 * Provides functions, and information, for interacting with Stream Deck actions.
 */
class ActionService extends ReadOnlyActionStore {
    /**
     * Initializes a new instance of the {@link ActionService} class.
     */
    constructor() {
        super();
        // Adds the action to the store.
        connection.prependListener("willAppear", (ev) => {
            const action = ev.payload.controller === "Encoder" ? new DialAction(ev) : new KeyAction(ev);
            actionStore.set(action);
            if (actionConfig.useExperimentalMessageIdentifiers) {
                settingsCache.set(ev.context, ev.payload.settings);
            }
        });
        // Update the settings cache when settings are received.
        connection.prependListener("didReceiveSettings", (ev) => {
            if (actionConfig.useExperimentalMessageIdentifiers) {
                settingsCache.set(ev.context, ev.payload.settings);
            }
        });
        // Remove the action from the store.
        connection.prependListener("willDisappear", (ev) => {
            actionStore.delete(ev.context);
            settingsCache.delete(ev.context);
        });
    }
    /**
     * Occurs when the user presses a dial (Stream Deck +).
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDialDown(listener) {
        return connection.disposableOn("dialDown", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action?.isDial()) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the user rotates a dial (Stream Deck +).
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDialRotate(listener) {
        return connection.disposableOn("dialRotate", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action?.isDial()) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the user releases a pressed dial (Stream Deck +).
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDialUp(listener) {
        return connection.disposableOn("dialUp", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action?.isDial()) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the resources were updated within the property inspector.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDidReceiveResources(listener) {
        return connection.disposableOn("didReceiveResources", (ev) => {
            // When the id is defined, the resources were requested, so we don't propagate the event.
            if (ev.id !== undefined) {
                return;
            }
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the user presses a action down.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onKeyDown(listener) {
        return connection.disposableOn("keyDown", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action?.isKey()) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the user releases a pressed action.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onKeyUp(listener) {
        return connection.disposableOn("keyUp", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action?.isKey()) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the user updates an action's title settings in the Stream Deck application. See also {@link Action.setTitle}.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onTitleParametersDidChange(listener) {
        return connection.disposableOn("titleParametersDidChange", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the user taps the touchscreen (Stream Deck +).
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onTouchTap(listener) {
        return connection.disposableOn("touchTap", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action?.isDial()) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when an action appears on the Stream Deck due to the user navigating to another page, profile, folder, etc. This also occurs during startup if the action is on the "front
     * page". An action refers to _all_ types of actions, e.g. keys, dials,
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onWillAppear(listener) {
        return connection.disposableOn("willAppear", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when an action disappears from the Stream Deck due to the user navigating to another page, profile, folder, etc. An action refers to _all_ types of actions, e.g. keys,
     * dials, touchscreens, pedals, etc.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onWillDisappear(listener) {
        return connection.disposableOn("willDisappear", (ev) => listener(new ActionEvent(new ActionContext(ev), ev)));
    }
    /**
     * Registers the action with the Stream Deck, routing all events associated with the {@link SingletonAction.manifestId} to the specified {@link action}.
     * @param action The action to register.
     * @example
     * ＠action({ UUID: "com.elgato.test.action" })
     * class MyCustomAction extends SingletonAction {
     *     export function onKeyDown(ev: KeyDownEvent) {
     *         // Do some awesome thing.
     *     }
     * }
     *
     * streamDeck.actions.registerAction(new MyCustomAction());
     */
    registerAction(action) {
        if (action.manifestId === undefined) {
            throw new Error("The action's manifestId cannot be undefined.");
        }
        if (manifest.value !== null && !manifest.value.Actions.some((a) => a.UUID === action.manifestId)) {
            throw new Error(`The action's manifestId was not found within the manifest: ${action.manifestId}`);
        }
        // Routes an event to the action, when the applicable listener is defined on the action.
        const { manifestId } = action;
        const route = (fn, listener) => {
            const boundedListener = listener?.bind(action);
            if (boundedListener === undefined) {
                return;
            }
            fn.bind(action)(async (ev) => {
                if (ev.action.manifestId == manifestId) {
                    await boundedListener(ev);
                }
            });
        };
        // Route each of the action events.
        route(this.onDialDown, action.onDialDown);
        route(this.onDialUp, action.onDialUp);
        route(this.onDialRotate, action.onDialRotate);
        route(ui.onSendToPlugin, action.onSendToPlugin);
        route(this.onDidReceiveResources, action.onDidReceiveResources);
        route(settings.onDidReceiveSettings, action.onDidReceiveSettings);
        route(this.onKeyDown, action.onKeyDown);
        route(this.onKeyUp, action.onKeyUp);
        route(ui.onDidAppear, action.onPropertyInspectorDidAppear);
        route(ui.onDidDisappear, action.onPropertyInspectorDidDisappear);
        route(this.onTitleParametersDidChange, action.onTitleParametersDidChange);
        route(this.onTouchTap, action.onTouchTap);
        route(this.onWillAppear, action.onWillAppear);
        route(this.onWillDisappear, action.onWillDisappear);
    }
}
/**
 * Service for interacting with Stream Deck actions.
 */
const actionService = new ActionService();

/**
 * Provides information about a device.
 */
class Device {
    /**
     * Private backing field for {@link Device.isConnected}.
     */
    #isConnected = false;
    /**
     * Private backing field for the device's information.
     */
    #info;
    /**
     * Unique identifier of the device.
     */
    id;
    /**
     * Initializes a new instance of the {@link Device} class.
     * @param id Device identifier.
     * @param info Information about the device.
     * @param isConnected Determines whether the device is connected.
     */
    constructor(id, info, isConnected) {
        this.id = id;
        this.#info = info;
        this.#isConnected = isConnected;
        // Set connected.
        connection.prependListener("deviceDidConnect", (ev) => {
            if (ev.device === this.id) {
                this.#info = ev.deviceInfo;
                this.#isConnected = true;
            }
        });
        // Track changes.
        connection.prependListener("deviceDidChange", (ev) => {
            if (ev.device === this.id) {
                this.#info = ev.deviceInfo;
            }
        });
        // Set disconnected.
        connection.prependListener("deviceDidDisconnect", (ev) => {
            if (ev.device === this.id) {
                this.#isConnected = false;
            }
        });
    }
    /**
     * Actions currently visible on the device.
     * @returns Collection of visible actions.
     */
    get actions() {
        return actionStore.filter((a) => a.device.id === this.id);
    }
    /**
     * Determines whether the device is currently connected.
     * @returns `true` when the device is connected; otherwise `false`.
     */
    get isConnected() {
        return this.#isConnected;
    }
    /**
     * Name of the device, as specified by the user in the Stream Deck application.
     * @returns Name of the device.
     */
    get name() {
        return this.#info.name;
    }
    /**
     * Number of action slots, excluding dials / touchscreens, available to the device.
     * @returns Size of the device.
     */
    get size() {
        return this.#info.size;
    }
    /**
     * Type of the device that was connected, e.g. Stream Deck +, Stream Deck Pedal, etc. See {@link DeviceType}.
     * @returns Type of the device.
     */
    get type() {
        return this.#info.type;
    }
}

/**
 * Provides functions, and information, for interacting with Stream Deck actions.
 */
class DeviceService extends ReadOnlyDeviceStore {
    /**
     * Initializes a new instance of the {@link DeviceService}.
     */
    constructor() {
        super();
        // Add the devices from registration parameters.
        connection.once("connected", (info) => {
            info.devices.forEach((dev) => deviceStore.set(new Device(dev.id, dev, false)));
        });
        // Add new devices that were connected.
        connection.on("deviceDidConnect", ({ device: id, deviceInfo }) => {
            if (!deviceStore.getDeviceById(id)) {
                deviceStore.set(new Device(id, deviceInfo, true));
            }
        });
        // Add new devices that were changed (Virtual Stream Deck event race).
        connection.on("deviceDidChange", ({ device: id, deviceInfo }) => {
            if (!deviceStore.getDeviceById(id)) {
                deviceStore.set(new Device(id, deviceInfo, false));
            }
        });
    }
    /**
     * Occurs when a Stream Deck device changed, for example its name or size.
     *
     * Available from Stream Deck 7.0.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDeviceDidChange(listener) {
        requiresVersion(7.0, connection.version, "onDeviceDidChange");
        return connection.disposableOn("deviceDidChange", (ev) => listener(new DeviceEvent(ev, this.getDeviceById(ev.device))));
    }
    /**
     * Occurs when a Stream Deck device is connected. See also {@link DeviceService.onDeviceDidConnect}.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDeviceDidConnect(listener) {
        return connection.disposableOn("deviceDidConnect", (ev) => listener(new DeviceEvent(ev, this.getDeviceById(ev.device))));
    }
    /**
     * Occurs when a Stream Deck device is disconnected. See also {@link DeviceService.onDeviceDidDisconnect}.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDeviceDidDisconnect(listener) {
        return connection.disposableOn("deviceDidDisconnect", (ev) => listener(new DeviceEvent(ev, this.getDeviceById(ev.device))));
    }
}
/**
 * Provides functions, and information, for interacting with Stream Deck actions.
 */
const deviceService = new DeviceService();

/**
 * Loads a locale from the file system.
 * @param language Language to load.
 * @returns Contents of the locale.
 */
function fileSystemLocaleProvider(language) {
    const filePath = path.join(process.cwd(), `${language}.json`);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        // Parse the translations from the file.
        const contents = fs.readFileSync(filePath, { flag: "r" })?.toString();
        return parseLocalizations(contents);
    }
    catch (err) {
        logger.error(`Failed to load translations from ${filePath}`, err);
        return null;
    }
}
/**
 * Parses the localizations from the specified contents, or throws a `TypeError` when unsuccessful.
 * @param contents Contents that represent the stringified JSON containing the localizations.
 * @returns The localizations; otherwise a `TypeError`.
 */
function parseLocalizations(contents) {
    const json = JSON.parse(contents);
    if (json !== undefined && json !== null && typeof json === "object" && "Localization" in json) {
        return json["Localization"];
    }
    throw new TypeError(`Translations must be a JSON object nested under a property named "Localization"`);
}

/**
 * Requests the Stream Deck switches the current profile of the specified {@link deviceId} to the {@link profile}; when no {@link profile} is provided the previously active profile
 * is activated.
 *
 * NB: Plugins may only switch to profiles distributed with the plugin, as defined within the manifest, and cannot access user-defined profiles.
 * @param deviceId Unique identifier of the device where the profile should be set.
 * @param profile Optional name of the profile to switch to; when `undefined` the previous profile will be activated. Name must be identical to the one provided in the manifest.
 * @param page Optional page to show when switching to the {@link profile}, indexed from 0. When `undefined`, the page that was previously visible (when switching away from the
 * profile) will be made visible.
 * @returns `Promise` resolved when the request to switch the `profile` has been sent to Stream Deck.
 */
function switchToProfile(deviceId, profile, page) {
    if (page !== undefined) {
        requiresVersion(6.5, connection.version, "Switching to a profile page");
    }
    return connection.send({
        event: "switchToProfile",
        context: connection.registrationParameters.pluginUUID,
        device: deviceId,
        payload: {
            page,
            profile,
        },
    });
}

var profiles = /*#__PURE__*/Object.freeze({
    __proto__: null,
    switchToProfile: switchToProfile
});

/**
 * Occurs when a monitored application is launched. Monitored applications can be defined in the manifest via the {@link Manifest.ApplicationsToMonitor} property.
 * See also {@link onApplicationDidTerminate}.
 * @param listener Function to be invoked when the event occurs.
 * @returns A disposable that, when disposed, removes the listener.
 */
function onApplicationDidLaunch(listener) {
    return connection.disposableOn("applicationDidLaunch", (ev) => listener(new ApplicationEvent(ev)));
}
/**
 * Occurs when a monitored application terminates. Monitored applications can be defined in the manifest via the {@link Manifest.ApplicationsToMonitor} property.
 * See also {@link onApplicationDidLaunch}.
 * @param listener Function to be invoked when the event occurs.
 * @returns A disposable that, when disposed, removes the listener.
 */
function onApplicationDidTerminate(listener) {
    return connection.disposableOn("applicationDidTerminate", (ev) => listener(new ApplicationEvent(ev)));
}
/**
 * Occurs when a deep-link message is routed to the plugin from Stream Deck. One-way deep-link messages can be sent to plugins from external applications using the URL format
 * `streamdeck://plugins/message/<PLUGIN_UUID>/{MESSAGE}`.
 * @param listener Function to be invoked when the event occurs.
 * @returns A disposable that, when disposed, removes the listener.
 */
function onDidReceiveDeepLink(listener) {
    requiresVersion(6.5, connection.version, "Receiving deep-link messages");
    return connection.disposableOn("didReceiveDeepLink", (ev) => listener(new DidReceiveDeepLinkEvent(ev)));
}
/**
 * Occurs when the computer wakes up.
 * @param listener Function to be invoked when the event occurs.
 * @returns A disposable that, when disposed, removes the listener.
 */
function onSystemDidWakeUp(listener) {
    return connection.disposableOn("systemDidWakeUp", (ev) => listener(new Event(ev)));
}
/**
 * Opens the specified `url` in the user's default browser.
 * @param url URL to open.
 * @returns `Promise` resolved when the request to open the `url` has been sent to Stream Deck.
 */
function openUrl(url) {
    return connection.send({
        event: "openUrl",
        payload: {
            url,
        },
    });
}
/**
 * Gets the secrets associated with the plugin.
 * @returns `Promise` resolved with the secrets associated with the plugin.
 */
function getSecrets() {
    requiresVersion(6.9, connection.version, "Secrets");
    requiresSDKVersion(3, "Secrets");
    return new Promise((resolve) => {
        connection.once("didReceiveSecrets", (ev) => resolve(ev.payload.secrets));
        connection.send({
            event: "getSecrets",
            context: connection.registrationParameters.pluginUUID,
        });
    });
}

var system = /*#__PURE__*/Object.freeze({
    __proto__: null,
    getSecrets: getSecrets,
    onApplicationDidLaunch: onApplicationDidLaunch,
    onApplicationDidTerminate: onApplicationDidTerminate,
    onDidReceiveDeepLink: onDidReceiveDeepLink,
    onSystemDidWakeUp: onSystemDidWakeUp,
    openUrl: openUrl
});

/**
 * Defines a Stream Deck action associated with the plugin.
 * @param definition The definition of the action, e.g. it's identifier, name, etc.
 * @returns The definition decorator.
 */
function action(definition) {
    const manifestId = definition.UUID;
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unused-vars
    return function (target, context) {
        return class extends target {
            /**
             * The universally-unique value that identifies the action within the manifest.
             */
            manifestId = manifestId;
        };
    };
}

/**
 * Provides the main bridge between the plugin and the Stream Deck allowing the plugin to send requests and receive events, e.g. when the user presses an action.
 * @template T The type of settings associated with the action.
 */
class SingletonAction {
    /**
     * The universally-unique value that identifies the action within the manifest.
     */
    manifestId;
    /**
     * Gets the visible actions with the `manifestId` that match this instance's.
     * @returns The visible actions.
     */
    get actions() {
        return actionStore.filter((a) => a.manifestId === this.manifestId);
    }
}

let i18n;
const streamDeck = {
    /**
     * Namespace for event listeners and functionality relating to Stream Deck actions.
     * @returns Actions namespace.
     */
    get actions() {
        return actionService;
    },
    /**
     * Namespace for interacting with Stream Deck devices.
     * @returns Devices namespace.
     */
    get devices() {
        return deviceService;
    },
    /**
     * Internalization provider, responsible for managing localizations and translating resources.
     * @returns Internalization provider.
     */
    get i18n() {
        return (i18n ??= new I18nProvider(this.info.application.language, fileSystemLocaleProvider));
    },
    /**
     * Registration and application information provided by Stream Deck during initialization.
     * @returns Registration information.
     */
    get info() {
        return connection.registrationParameters.info;
    },
    /**
     * Logger responsible for capturing log messages.
     * @returns The logger.
     */
    get logger() {
        return logger;
    },
    /**
     * Namespace for Stream Deck profiles.
     * @returns Profiles namespace.
     */
    get profiles() {
        return profiles;
    },
    /**
     * Namespace for persisting settings within Stream Deck.
     * @returns Settings namespace.
     */
    get settings() {
        return settings;
    },
    /**
     * Namespace for interacting with, and receiving events from, the system the plugin is running on.
     * @returns System namespace.
     */
    get system() {
        return system;
    },
    /**
     * Namespace for interacting with UI (property inspector) associated with the plugin.
     * @returns UI namespace.
     */
    get ui() {
        return ui;
    },
    /**
     * Connects the plugin to the Stream Deck.
     * @returns A promise resolved when a connection has been established.
     */
    connect() {
        return connection.connect();
    },
};

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
}
function __runInitializers(thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
}
typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

const DEFAULT_SETTINGS = {
    serviceName: "",
    endpointUrl: "",
    checkFrequency: "1m",
    expectedStatusCode: 200,
    timeoutMs: 5000,
    slowThresholdMs: 1000,
    amberAfterFailures: 1,
    redAfterFailures: 3,
    // 1 is the behaviour that shipped before this setting existed, so an existing button whose
    // settings predate it is unaffected by the coercion in mergeWithDefaults.
    recoverAfterSuccesses: 1,
    expectedBodyContains: "",
    showBodySnippetInHistory: false,
    headers: [],
    history: [],
    currentState: "unknown",
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    lastCheckedAt: null,
    lastStatusCode: null,
    lastResponseTimeMs: null,
};

const MAX_BODY_SNIPPET = 500;
/**
 * Turns a thrown fetch error into something worth reading in the history.
 *
 * Node's fetch reports every transport failure as `TypeError: fetch failed` and puts the actual
 * reason on `cause` — so a refused connection, an unresolvable host and an expired certificate
 * all arrive looking identical. Reading the cause is the difference between "fetch failed" and
 * "connect ECONNREFUSED 10.0.0.1:443", which is the whole value of the column it lands in.
 */
function describeFetchError(err) {
    if (!(err instanceof Error))
        return "Unknown error";
    const cause = err.cause;
    const detail = cause instanceof Error ? cause.message
        : typeof cause === "string" ? cause
            : null;
    if (!detail)
        return err.message;
    // "fetch failed" carries no information of its own, so the cause replaces it rather than
    // trailing it. Anything more specific keeps both halves.
    return err.message === "fetch failed" ? detail : `${err.message}: ${detail}`;
}
/**
 * Turns configured header rows into something `fetch` will accept.
 *
 * Rows are dropped rather than repaired when they cannot be sent: an empty name is a row someone
 * started and abandoned, and a name carrying a colon, whitespace or a newline would either be
 * rejected by fetch or, in the newline case, be an attempt to inject a second header. A single bad
 * row must not fail the whole check, because the state it produces would say the *service* is
 * down.
 */
function buildHeaders(headers) {
    const out = {};
    for (const header of headers ?? []) {
        const name = String(header?.name ?? "").trim();
        const value = String(header?.value ?? "").trim();
        if (!name)
            continue;
        if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name))
            continue;
        if (/[\r\n]/.test(value))
            continue;
        // Last one wins, which is what a form's later row visually implies.
        out[name] = value;
    }
    return out;
}
async function runHealthCheck(settings) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), settings.timeoutMs);
    const start = Date.now();
    try {
        const response = await fetch(settings.endpointUrl.trim(), {
            method: "GET",
            headers: buildHeaders(settings.headers),
            signal: controller.signal,
        });
        clearTimeout(timeoutHandle);
        const responseTimeMs = Date.now() - start;
        const statusMatched = response.status === settings.expectedStatusCode;
        let bodyMatched = null;
        let bodySnippet = null;
        let bodyText = "";
        const needsBody = settings.expectedBodyContains.trim() !== "" ||
            settings.showBodySnippetInHistory;
        if (needsBody) {
            try {
                bodyText = await response.text();
            }
            catch {
                bodyText = "";
            }
        }
        if (settings.expectedBodyContains.trim() !== "") {
            bodyMatched = bodyText.includes(settings.expectedBodyContains.trim());
        }
        if (settings.showBodySnippetInHistory && bodyText) {
            bodySnippet = bodyText.slice(0, MAX_BODY_SNIPPET);
        }
        const ok = statusMatched && (bodyMatched === null || bodyMatched);
        let error = null;
        if (!statusMatched) {
            error = `Expected status ${settings.expectedStatusCode} but received ${response.status}`;
        }
        else if (bodyMatched === false) {
            error = `Response body did not contain "${settings.expectedBodyContains}"`;
        }
        return {
            ok,
            statusCode: response.status,
            responseTimeMs,
            bodyMatched,
            bodySnippet,
            error,
        };
    }
    catch (err) {
        clearTimeout(timeoutHandle);
        const responseTimeMs = Date.now() - start;
        const isAbort = err instanceof Error && err.name === "AbortError";
        return {
            ok: false,
            statusCode: null,
            responseTimeMs: isAbort ? settings.timeoutMs : responseTimeMs,
            bodyMatched: null,
            bodySnippet: null,
            error: isAbort
                ? `Request timed out after ${settings.timeoutMs}ms`
                : describeFetchError(err),
        };
    }
}

const STATE_LABELS = {
    unknown: "Unknown",
    checking: "Checking",
    healthy: "Healthy",
    slow: "Slow",
    warning: "Warning",
    down: "Down",
    "config-error": "Configuration error",
};
function stateLabel(state) {
    return STATE_LABELS[state] ?? state;
}
const FREQUENCY_LABELS = {
    manual: "manual only",
    "1m": "every minute",
    "5m": "every 5 minutes",
    "10m": "every 10 minutes",
    "30m": "every 30 minutes",
    "1h": "hourly",
};
function frequencyLabel(frequency) {
    return FREQUENCY_LABELS[frequency] ?? frequency;
}
/**
 * Nearest-rank percentile, which is the right choice for a sample this small: interpolating
 * between two of 60 checks invents a latency that was never measured.
 */
function percentile(values, p) {
    if (values.length === 0)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.ceil((p / 100) * sorted.length);
    return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}
function buildStats(history, slowThresholdMs) {
    const ok = history.filter((r) => r.ok);
    const latencies = ok.map((r) => r.responseTimeMs);
    const total = history.length;
    return {
        total,
        ok: ok.length,
        failed: total - ok.length,
        uptimePct: total === 0 ? null : Math.round((ok.length / total) * 1000) / 10,
        median: percentile(latencies, 50),
        // Only successful checks can be slow: a failure is a failure, however long it took to fail.
        overThreshold: latencies.filter((ms) => ms > slowThresholdMs).length,
        fastest: latencies.length ? Math.min(...latencies) : null,
        slowest: latencies.length ? Math.max(...latencies) : null,
        average: latencies.length
            ? Math.round(latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length)
            : null,
        latencySamples: latencies.length,
    };
}
function buildSnapshot(settings) {
    const history = settings.history ?? [];
    return {
        serviceName: settings.serviceName || "Unnamed service",
        endpointUrl: settings.endpointUrl,
        state: settings.currentState,
        stateLabel: stateLabel(settings.currentState),
        consecutiveFailures: settings.consecutiveFailures,
        checkFrequency: frequencyLabel(settings.checkFrequency),
        expectedStatusCode: settings.expectedStatusCode,
        timeoutMs: settings.timeoutMs,
        slowThresholdMs: settings.slowThresholdMs,
        lastCheckedAt: settings.lastCheckedAt,
        checks: history.map((r) => ({
            timestamp: r.timestamp,
            ok: r.ok,
            state: r.state,
            statusCode: r.statusCode,
            responseTimeMs: r.responseTimeMs,
            error: r.error,
            // Only carried when the user asked for it — the body of a health endpoint can hold more
            // than a status word, and this ends up in a window anyone walking past can read.
            bodySnippet: settings.showBodySnippetInHistory ? r.bodySnippet : null,
        })),
        stats: buildStats(history, settings.slowThresholdMs),
        generatedAt: Date.now(),
    };
}

const MAX_HISTORY = 60;
function appendRecord(history, record) {
    const updated = [...history, record];
    return updated.length > MAX_HISTORY
        ? updated.slice(updated.length - MAX_HISTORY)
        : updated;
}
function uptimeRatio(history) {
    if (history.length === 0)
        return "N/A";
    const ok = history.filter((r) => r.ok).length;
    return `${ok}/${history.length} checks successful`;
}
function averageLatency(history) {
    if (history.length === 0)
        return null;
    const total = history.reduce((sum, r) => sum + r.responseTimeMs, 0);
    return Math.round(total / history.length);
}
function formatHistoryPopup(serviceName, currentState, consecutiveFailures, history) {
    const name = serviceName || "Unnamed Service";
    if (history.length === 0) {
        return [
            `PulseDeck: ${name}`,
            "",
            "No checks have run yet.",
            "",
            "Press the key to run a health check.",
        ].join("\n");
    }
    const latest = history[history.length - 1];
    const avgMs = averageLatency(history);
    const lastChecked = new Date(latest.timestamp).toLocaleString();
    const lastCheckLine = latest.ok
        ? `${latest.statusCode} in ${latest.responseTimeMs}ms`
        : latest.error || "Failed";
    const lines = [
        `PulseDeck: ${name}`,
        "",
        `Current: ${stateLabel(currentState)}`,
        `Last check: ${lastCheckLine}`,
        `Uptime: ${uptimeRatio(history)}`,
        `Average latency: ${avgMs !== null ? `${avgMs}ms` : "N/A"}`,
        `Consecutive failures: ${consecutiveFailures}`,
        `Last checked: ${lastChecked}`,
        "",
        "Recent checks:",
    ];
    const recent = history.slice(-15).reverse();
    for (const r of recent) {
        const time = new Date(r.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
        const status = r.ok ? "OK  " : "FAIL";
        const code = r.statusCode !== null ? String(r.statusCode) : "---";
        const ms = `${r.responseTimeMs}ms`;
        lines.push(`${time}  ${status}  ${code}  ${ms}`);
    }
    return lines.join("\n");
}

function showPopup(content) {
    // Escape special characters for AppleScript string
    const escaped = content
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
    const script = `display dialog "${escaped}" buttons {"OK"} default button "OK" with title "PulseDeck"`;
    try {
        child_process.execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
            timeout: 30000,
        });
    }
    catch {
        // User dismissed or osascript unavailable — not an error
    }
}

/**
 * The plumbing every plugin window shares: an ephemeral loopback server, a token that gates it,
 * a native host to display it, and the rules for when a host has failed rather than been closed.
 *
 * Extracted when the board window needed all of it. The alternative was a second copy, which is
 * how the picker's host lookup came to exist in three places in quick-clips before it was pulled
 * into one — and duplicated security code is the kind that drifts.
 *
 * Callers supply the page and handle their own message types; ping, close and error are handled
 * here because they mean the same thing for any window.
 */
/** Bundled native host, relative to the sdPlugin root (the plugin's working directory). */
const NATIVE_HOST = "bin/pulse-host";
/** Chromium-family browsers that support `--app=` windows, in preference order. */
const BROWSER_CANDIDATES = {
    darwin: [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
    // The native host is macOS only and there is no osascript fallback on Windows, so a browser is
    // the only way these windows work there.
    win32: [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ],
};
/**
 * A host that never asked for the page has failed, even if its process is still alive: a binary
 * macOS refuses to run can hang rather than exit.
 */
const PAGE_LOAD_TIMEOUT_MS = 6_000;
/** Thrown when a host could not display anything — try the next one, do not treat as a close. */
class WindowLaunchError extends Error {
}
/**
 * Returns every command capable of showing a window, best first.
 *
 * All of them rather than the best one, because a host can be present yet unlaunchable — a
 * quarantined unsigned binary is the usual case — so callers work down the list.
 */
async function findHosts() {
    const hosts = [];
    try {
        await promises.access(NATIVE_HOST, fs.constants.X_OK);
        hosts.push(NATIVE_HOST);
    }
    catch {
        // `streamdeck pack` stores no permission bits, so a packed install's host arrives without its
        // exec bit. plugin.js is unaffected because Stream Deck runs it as an argument to node.
        try {
            await promises.access(NATIVE_HOST, fs.constants.F_OK);
            await promises.chmod(NATIVE_HOST, 0o755);
            await promises.access(NATIVE_HOST, fs.constants.X_OK);
            hosts.push(NATIVE_HOST);
        }
        catch {
            // Not built for this checkout, or not writable — browsers only.
        }
    }
    for (const path of BROWSER_CANDIDATES[node_os.platform()] ?? []) {
        try {
            await promises.access(path);
            hosts.push(path);
        }
        catch {
            // Not installed — try the next candidate.
        }
    }
    return hosts;
}
/**
 * Serves a window and resolves when it closes.
 *
 * @param hostPath Executable from {@link findHosts}. Spawned directly rather than through `open`,
 * because `open -a` drops `--args` when the browser is already running, which would surface the
 * page as an ordinary tab instead of an app window.
 */
async function serveWindow(hostPath, options) {
    const token = node_crypto.randomBytes(16).toString("hex");
    const warn = options.onWarn ?? (() => { });
    return new Promise((resolve, reject) => {
        let settled = false;
        let child;
        let idleTimer;
        let loadWatchdog;
        let pageServed = false;
        const server = node_http.createServer(handle);
        function stop() {
            if (idleTimer)
                clearTimeout(idleTimer);
            if (loadWatchdog)
                clearTimeout(loadWatchdog);
            server.close();
            // The window owns nothing else, so terminating the host is safe.
            child?.kill();
        }
        function finish() {
            if (settled)
                return;
            settled = true;
            stop();
            resolve();
        }
        /** A host that never displayed anything — the caller should try the next one. */
        function failLaunch(detail) {
            if (settled)
                return;
            settled = true;
            stop();
            reject(new WindowLaunchError(`${hostPath} failed to launch: ${detail}`));
        }
        function armIdleTimer() {
            if (settled)
                return;
            if (idleTimer)
                clearTimeout(idleTimer);
            idleTimer = setTimeout(finish, options.timeoutMs);
        }
        function sendJson(res, payload) {
            res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(payload ?? {}));
        }
        function handle(req, res) {
            const url = new URL(req.url ?? "/", "http://127.0.0.1");
            // Any local process can reach this port, so the token gates every route before any routing.
            if (url.searchParams.get("t") !== token) {
                res.writeHead(403).end("forbidden");
                return;
            }
            if (url.pathname === "/") {
                pageServed = true;
                if (loadWatchdog)
                    clearTimeout(loadWatchdog);
                res.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "no-store, no-cache, must-revalidate",
                }).end(options.renderPage(token));
                return;
            }
            const extra = options.renderRoute?.(url.pathname, url.searchParams);
            if (typeof extra === "string") {
                res.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "no-store, no-cache, must-revalidate",
                }).end(extra);
                return;
            }
            if (url.pathname === "/message" && req.method === "POST") {
                let body = "";
                req.on("data", (chunk) => { body += chunk; });
                req.on("end", () => {
                    let parsed;
                    try {
                        parsed = JSON.parse(body);
                    }
                    catch {
                        sendJson(res, {});
                        return;
                    }
                    if (parsed.type === "ping") {
                        armIdleTimer();
                        sendJson(res, {});
                        return;
                    }
                    if (parsed.type === "error" && typeof parsed.message === "string") {
                        warn(`window page error: ${parsed.message}`);
                        sendJson(res, {});
                        return;
                    }
                    if (parsed.type === "close") {
                        sendJson(res, {});
                        finish();
                        return;
                    }
                    const handler = options.onMessage;
                    if (!handler) {
                        sendJson(res, {});
                        return;
                    }
                    Promise.resolve()
                        .then(() => handler(parsed))
                        .then((reply) => sendJson(res, reply))
                        .catch((error) => {
                        const message = error instanceof Error ? error.message : "Failed";
                        warn(`window message "${String(parsed.type)}" failed: ${message}`);
                        sendJson(res, { message });
                    });
                });
                return;
            }
            res.writeHead(404).end("not found");
        }
        server.on("error", (error) => failLaunch(error.message));
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            const target = `http://127.0.0.1:${port}/?t=${token}`;
            // Chrome's own flag spelling, which the native host also accepts, so the two are
            // interchangeable and nothing here needs to know which one it spawned.
            child = node_child_process.spawn(hostPath, [
                `--app=${target}`,
                `--window-size=${options.width},${options.height}`,
                "--no-first-run",
                "--no-default-browser-check",
            ], { stdio: ["ignore", "ignore", "pipe"], detached: false });
            child.stderr?.on("data", (chunk) => {
                const text = String(chunk).trim();
                if (text)
                    warn(text);
            });
            child.on("error", (error) => failLaunch(error.message));
            // Exit status separates the two reasons a host can be gone: code 0 means it ran and the
            // window was closed (the page's own close message usually beats this, but it can lose the
            // race); anything else means it never displayed, and the next host is worth trying.
            child.on("exit", (code, signal) => {
                if (settled)
                    return;
                if (code === 0 && !signal)
                    finish();
                else
                    failLaunch(signal ? `killed by ${signal}` : `exited with code ${code}`);
            });
            options.onOpen?.(finish);
            armIdleTimer();
            loadWatchdog = setTimeout(() => {
                if (!pageServed)
                    failLaunch(`never requested the page within ${PAGE_LOAD_TIMEOUT_MS}ms`);
            }, PAGE_LOAD_TIMEOUT_MS);
        });
    });
}

/** Content-area size. Wide enough for 60 columns at a readable width, tall enough for both cards. */
const WINDOW_WIDTH$1 = 900;
const WINDOW_HEIGHT$1 = 740;
/** Fraction of leftover vertical space above the window; 0.5 is dead centre, lower sits higher. */
const VERTICAL_BIAS$1 = 0.35;
/**
 * How long the window may sit *idle* before closing itself. Re-armed by interaction only: the
 * page's own polling would otherwise hold it open forever, which is how an orphan window happens.
 */
const DEFAULT_TIMEOUT_MS$1 = 10 * 60_000;
/** How often the page asks for a fresh snapshot. Fast enough to feel live, cheap enough to ignore. */
const POLL_MS$1 = 2_000;
/**
 * Serialises data for a `<script>` block. `<` must be escaped or a `</script>` inside a body
 * snippet or an error message would end the block early.
 */
function embedJson$1(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
}
/** Escapes text for an HTML text node or attribute. */
function escapeHtml$1(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
/**
 * Lucide's `refresh-cw`, used as published. ISC licence — https://lucide.dev
 *
 * Stroke width is 2.4 rather than the set's own 2, because the glyph is drawn for a 24px render
 * and this one is 15px; at the published weight the arcs go wispy next to a semibold label.
 * `currentColor` lets it take the button's own ink — the page background on the accent fill, the
 * muted grey while disabled.
 */
const REFRESH_SVG$1 = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"`
    + ` stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
    + `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>`
    + `<path d="M21 3v5h-5"/>`
    + `<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>`
    + `<path d="M8 16H3v5"/></svg>`;
/**
 * Builds the page.
 *
 * Exported as a test seam. This is one large template literal holding HTML, CSS and the client
 * script, and a stray backtick in it ends the string early — sometimes as a compile error, and
 * sometimes as a page whose script cannot parse, which shows as a window that is simply blank
 * because the body stays hidden until the script marks it ready. `historyWindow.test.ts` parses
 * what this produces, so that is caught by `npm test` rather than by opening the window.
 *
 * Only the initial snapshot is embedded; every later render is driven by polled JSON, and all of
 * it reaches the DOM through `textContent` rather than markup.
 */
function renderHistoryHtml(snapshot, token, options) {
    const winW = options.width ?? WINDOW_WIDTH$1;
    const winH = options.height ?? WINDOW_HEIGHT$1;
    const pollMs = options.pollMs ?? POLL_MS$1;
    return `<!doctype html>
<html lang="en" style="background:#333333">
<head>
<meta charset="utf-8" />
<!--
  Declared here as well as in the stylesheet: a fresh document paints its base canvas before any
  CSS is applied, which showed as a white flash each time the board swapped one service's frame
  for another. The inline background and the colour-scheme hint both land at parse time.
-->
<meta name="color-scheme" content="dark" />
<title>${escapeHtml$1(snapshot.serviceName)} — PulseDeck</title>
<script>
/*
 * Runs before the body is parsed, so a browser window is sized and placed ahead of first paint.
 *
 * Chrome ignores --window-size whenever it is already running, so the window opens at whatever
 * size it feels like and the chart would lay out once at that width before reflowing. The body
 * stays hidden until the resize lands; the page background is on <html>, which stays visible, so
 * the gap reads as an empty themed window rather than a white flash.
 */
(function () {
  var W = ${winW}, H = ${winH};
  var EMBEDDED = ${options.embedded ? "true" : "false"};
  var root = document.documentElement;
  var revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    root.classList.add('ready');
  }
  // The native host creates the window already sized and placed, and resizeTo() there would size
  // the *outer* frame and cost the content the height of the title bar.
  // An embedded page is a frame inside someone else's window: there is nothing to size, and
  // resizeTo would either be ignored or, worse, resize the host window around it.
  if (window.__nativeHost || EMBEDDED) { reveal(); return; }
  try {
    var chromeW = Math.max(0, window.outerWidth - window.innerWidth);
    var chromeH = Math.max(0, window.outerHeight - window.innerHeight);
    var outerW = W + chromeW, outerH = H + chromeH;
    window.resizeTo(outerW, outerH);
    // availLeft/availTop are the origin of the display this window landed on, so this centres on
    // that monitor rather than assuming the primary one.
    window.moveTo(
      Math.round((screen.availWidth - outerW) / 2) + (screen.availLeft || 0),
      Math.round((screen.availHeight - outerH) * ${VERTICAL_BIAS$1}) + (screen.availTop || 0)
    );
  } catch (e) {
    reveal();
  }
  // resizeTo is a request, not a synchronous change, so wait for it to land.
  window.addEventListener('resize', function onResize() {
    window.removeEventListener('resize', onResize);
    requestAnimationFrame(reveal);
  });
  setTimeout(reveal, 250);
})();
</script>
<style>
  /*
   * The Quick Clips picker's palette, verbatim, so the two windows read as the same plugin
   * family. Dark only, the same deliberate choice that page makes: these are transient panels
   * floating over the Stream Deck app, which is itself dark, and the native host pins the window
   * to .darkAqua so its title bar matches.
   */
  :root {
    color-scheme: dark;
    --bg: #333333;
    /* Translucent form of --bg so the sticky header reads as the same surface */
    --header: rgba(51,51,51,.92);
    --line: rgba(255,255,255,.08);
    --fg: #f4f4f6;
    --fg-dim: #8b8b93;
    --fg-faint: #62626b;
    --card: #262626;
    --card-line: #515151;
    --hover: rgba(255,255,255,.04);
    --kbd: rgba(255,255,255,.09);
    --shadow: 0 1px 2px rgba(0,0,0,.3);
    --shadow-lift: 0 6px 18px rgba(0,0,0,.45);
    --accent: #6d9eeb;

    /* Chart marks. Healthy is the same green as the key and the state pill. */
    --ok: var(--good);
    --slow: #fab219;
    --fail: #d03b3b;
    --good: #29bd50;
    --serious: #ec835a;
  }

  * { box-sizing: border-box; }
  html, body { height: 100%; }
  /* Background lives on <html> so the window is themed even while <body> is hidden. */
  html { background: var(--bg); }
  /* Content stays hidden until the window has been sized — see the head script. */
  html:not(.ready) body { visibility: hidden; }
  body {
    margin: 0;
    font: 400 13px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
    background: var(--bg); color: var(--fg);
    -webkit-font-smoothing: antialiased;
    -webkit-user-select: none; user-select: none;
    display: flex; flex-direction: column; overflow: hidden;
  }
  /* One content column with the picker's gutters, shared by every band of the window. */
  .wrap { width: 100%; max-width: 1080px; margin: 0 auto; padding: 0 22px; }
  main {
    flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 11px;
    padding: 12px 0 13px; overflow: hidden;
  }

  /* ── header ─────────────────────────────────────────────────────────── */
  /*
   * No hairline under the header, unlike the picker's.
   *
   * That rule earns its place there because the list scrolls underneath it and the line is what
   * separates moving content from a fixed bar. Here nothing scrolls under it — the cards are the
   * separation — so it was just a line across the window.
   */
  header { flex: 0 0 auto; background: var(--header); }
  header .wrap { display: flex; align-items: center; gap: 16px; padding-top: 12px; padding-bottom: 12px; }
  .id { min-width: 0; flex: 1 1 auto; }
  h1 {
    margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.015em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .meta {
    margin: 2px 0 0; color: var(--fg-dim); font-size: 12px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    -webkit-user-select: text; user-select: text;
  }
  /* Status reads as a dot plus a word — the colour never carries the state on its own. */
  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
    color: var(--fg-dim); margin-bottom: 4px;
  }
  .dot {
    display: inline-block; flex: none;
    width: 9px; height: 9px; border-radius: 50%; background: var(--fg-faint);
  }
  .pill[data-state="healthy"] .dot { background: var(--good); }
  .pill[data-state="slow"] .dot { background: var(--slow); }
  .pill[data-state="warning"] .dot { background: var(--serious); }
  .pill[data-state="down"] .dot { background: var(--fail); }
  .pill[data-state="checking"] .dot { animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: .3; } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none !important; } }

  /* The picker's primary button: accent fill, page colour for the label. */
  button {
    font: inherit; font-size: 12px; font-weight: 600; color: var(--bg);
    background: var(--accent); border: 0; border-radius: 7px;
    padding: 6px 12px; cursor: pointer; flex: 0 0 auto;
    display: inline-flex; align-items: center; gap: 6px;
  }
  button:hover:not(:disabled) { filter: brightness(1.08); }
  button:disabled { background: var(--card-line); color: var(--fg-faint); cursor: default; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  /* The arrow turns while a check is in flight — the button is only ever disabled then, so the
     state it animates from is exactly the one being reported. */
  button:disabled svg { animation: spin .9s linear infinite; transform-origin: 50% 50%; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { button:disabled svg { animation: none; } }

  /* ── tiles ──────────────────────────────────────────────────────────── */
  .tiles { flex: 0 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .tile {
    background: var(--card); border: 2px solid var(--card-line); border-radius: 11px;
    box-shadow: var(--shadow); padding: 9px 13px 10px;
  }
  /*
   * The label is an h2, the same as the card headings, so the window has one heading level
   * rather than two that can drift apart. Only the ink differs: at full strength it tied with
   * the value beneath it for the eye, and in a stat tile the number has to come first. The card
   * headings can carry full strength because they are the only text on the card.
   */
  .tile .label { margin: 0; color: var(--fg-dim); }
  .tile .value {
    font-size: 24px; font-weight: 600; letter-spacing: -.02em; margin-top: 1px; color: var(--fg);
  }
  .tile .value .unit { font-size: 12px; font-weight: 500; color: var(--fg-dim); margin-left: 3px; }
  .tile .sub { font-size: 11px; color: var(--fg-faint); margin-top: 1px; }

  /* ── cards ──────────────────────────────────────────────────────────── */
  .card {
    background: var(--card); border: 2px solid var(--card-line); border-radius: 11px;
    box-shadow: var(--shadow);
    padding: 11px 14px 9px; display: flex; flex-direction: column; min-height: 0;
  }
  /* The plot is a fixed height, so the card must not be flexed down to fit the table below it —
     without this the chart collapsed to its header and the table took the whole window. */
  .chart-card { flex: 0 0 auto; }
  .card-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 7px; }
  h2 { font-size: 13px; font-weight: 600; margin: 0; }
  .sub { font-size: 11px; color: var(--fg-faint); font-weight: 400; }
  .spacer { flex: 1; }

  .legend { display: flex; gap: 12px; font-size: 11px; color: var(--fg-dim); }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .key { display: inline-block; width: 9px; height: 9px; border-radius: 2px; }
  .key.ok { background: var(--ok); }
  .key.slow { background: var(--slow); }
  .key.fail { background: var(--fail); }
  /* The threshold rule is annotated here rather than in the plot, where its label would sit on
     top of whichever columns happen to reach that height. */
  .key.thresh {
    width: 14px; height: 0; border-radius: 0;
    border-top: 2px dashed var(--slow); align-self: center;
  }

  .plot { position: relative; height: 184px; }
  .plot svg { display: block; width: 100%; height: 100%; }
  .empty {
    display: flex; align-items: center; justify-content: center; height: 100%;
    color: var(--fg-faint); font-size: 12px;
  }

  .tip {
    position: absolute; pointer-events: none; opacity: 0; transition: opacity .08s;
    background: var(--bg); border: 1px solid var(--card-line); border-radius: 8px;
    box-shadow: var(--shadow-lift);
    padding: 7px 9px; font-size: 11.5px; line-height: 1.5; white-space: nowrap; z-index: 2;
  }
  .tip.on { opacity: 1; }
  .tip .t-head { font-weight: 600; display: flex; align-items: center; gap: 6px; color: var(--fg); }
  .tip .t-row { color: var(--fg-dim); font-variant-numeric: tabular-nums; }
  .tip .t-err { color: var(--fg-dim); max-width: 260px; white-space: normal; }

  /* ── table ──────────────────────────────────────────────────────────── */
  .table-card { flex: 1 1 auto; min-height: 0; }
  .scroll { overflow-y: auto; min-height: 0; margin: 0 -4px; padding: 0 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  /* The segmented filter, in the picker's secondary-button idiom rather than the accent one:
     these narrow a list, they do not perform the window's action. */
  .seg { display: flex; gap: 2px; }
  .seg button {
    font: inherit; font-size: 11px; font-weight: 500; color: var(--fg-dim);
    background: transparent; border: 0; border-radius: 6px;
    padding: 3px 8px; cursor: pointer;
  }
  .seg button:hover { background: var(--kbd); color: var(--fg); }
  .seg button.on { background: var(--kbd); color: var(--fg); }
  .seg button b { font-weight: 600; color: var(--fg-faint); margin-left: 2px; }
  .seg button.on b { color: var(--fg-dim); }
  /* Nothing to filter to, so the control says so by fading rather than by disappearing and
     shifting the header around it. */
  .seg button[disabled] { opacity: .4; pointer-events: none; }

  /* Column headers are buttons so sorting is reachable by keyboard, not just by click. */
  .sortbtn {
    font: inherit; font-size: 11px; font-weight: 500; color: var(--fg-faint);
    background: none; border: 0; padding: 0; cursor: pointer;
    display: inline-flex; align-items: center; gap: 3px;
  }
  .sortbtn:hover { color: var(--fg-dim); }
  .sortbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
  .sortbtn i { font-style: normal; font-size: 9px; color: var(--fg-dim); }

  /* nowrap everywhere: once the spacer takes the slack, the value columns are sized by their
     content, and a wrapping timestamp turns every row two lines tall. */
  th, td { white-space: nowrap; }
  th {
    text-align: left; font-weight: 500; color: var(--fg-faint); font-size: 11px;
    padding: 0 24px 5px 0; position: sticky; top: 0; background: var(--card);
  }
  td {
    padding: 4px 24px 4px 0; border-top: 1px solid var(--line);
    font-variant-numeric: tabular-nums; color: var(--fg-dim);
  }
  tr:hover td { background: var(--hover); }
  td.result { color: var(--fg); }
  td .res { display: inline-flex; align-items: center; gap: 6px; }
  td .res .dot { width: 7px; height: 7px; }
  td.detail {
    color: var(--fg-faint);
    /* max-width:0 with a percentage width is what lets a table cell ellipsise at all; without
       it the cell grows to fit and the text runs out of the card. */
    max-width: 0; width: 55%;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    -webkit-user-select: text; user-select: text;
  }
  /*
   * The column only exists when something has been written to it.
   *
   * Detail is empty for every passing check unless body snippets are turned on, so a healthy
   * service reserved more than half the table for a blank column and squeezed the four that had
   * values into the left edge. The class is set per render, so the column appears the moment a
   * check fails.
   */
  table:not(.has-detail) .detail { display: none; }
  /*
   * Column rhythm when there is no Detail column.
   *
   * Two failure modes to sit between: a table at width:100% spreads its slack over every column
   * and throws the four short ones into the corners of the card, while letting a spacer swallow
   * all of it crams them against the left edge. Fixed proportions give them an even rhythm over
   * about half the card, and the spacer takes only the remainder. These apply solely when Detail
   * is hidden — when it is present it is the column that should absorb the leftover width.
   */
  table:not(.has-detail) .c-time { width: 16%; }
  table:not(.has-detail) .c-result { width: 12%; }
  table:not(.has-detail) .c-code { width: 10%; }
  table:not(.has-detail) .c-resp { width: 14%; }
  table.has-detail .pad { display: none; }
  .pad { padding: 0; }
  td.blank { color: var(--fg-faint); }
  td.num, th.num { text-align: right; }

  /* ── footer ─────────────────────────────────────────────────────────── */
  /* The picker's hint strip: same height, same key chips, same muted voice. */
  footer { flex: 0 0 auto; background: var(--header); }
  footer .wrap { display: flex; align-items: center; gap: 16px; height: 38px; }
  footer span {
    display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--fg-faint);
  }
  footer .keys { margin-left: auto; gap: 12px; }
  kbd {
    display: inline-grid; place-items: center; min-width: 17px; height: 17px; padding: 0 4px;
    background: var(--kbd); border-radius: 4px; font: inherit; font-size: 10px; color: var(--fg-dim);
  }
${options.embedded ? `
  /*
   * Embedded, the host window owns the margins.
   *
   * These gutters exist so the page has breathing room against a window edge; inside a pane that
   * already has its own padding they are a second inset, and the tiles and chart sat short of the
   * heading above them and the button to their right. The frame is given the width it should
   * fill, so the page fills it.
   */
  .wrap { padding: 0; max-width: none; }
  main { padding: 0; }
` : ""}
</style>
</head>
<body>
${options.embedded ? "" : `<header>
  <div class="wrap">
    <div class="id">
      <span class="pill" id="pill"><span class="dot"></span><span id="pill-label"></span></span>
      <h1 id="name"></h1>
      <p class="meta" id="meta"></p>
    </div>
    ${options.canCheck
        ? `<button id="check">${REFRESH_SVG$1}<span id="check-label">Check now</span></button>`
        : ""}
  </div>
</header>`}

<main class="wrap">
<section class="tiles" id="tiles"></section>

<section class="card chart-card">
  <div class="card-head">
    <h2>Response time</h2>
    <span class="sub" id="chart-sub"></span>
    <span class="spacer"></span>
    <div class="legend" id="legend">
      <span><i class="key ok"></i>OK</span>
      <span><i class="key slow"></i>Slow</span>
      <span><i class="key fail"></i>Failed</span>
      <span><i class="key thresh"></i><span id="legend-thresh"></span></span>
    </div>
  </div>
  <div class="plot" id="plot">
    <div class="tip" id="tip" role="status"></div>
  </div>
</section>

<section class="card table-card">
  <div class="card-head">
    <h2>Recent checks</h2>
    <span class="sub" id="table-sub"></span>
    <span class="spacer"></span>
    <div class="seg" id="filter" role="group" aria-label="Filter checks">
      <button type="button" data-f="all">All <b></b></button>
      <button type="button" data-f="healthy">Healthy <b></b></button>
      <button type="button" data-f="slow">Slow <b></b></button>
      <button type="button" data-f="failed">Failed <b></b></button>
    </div>
  </div>
  <div class="scroll">
    <table id="checks">
      <thead><tr>
        <th class="c-time"><button type="button" class="sortbtn" data-s="time">Time<i></i></button></th>
        <th class="c-result"><button type="button" class="sortbtn" data-s="result">Result<i></i></button></th>
        <th class="c-code"><button type="button" class="sortbtn" data-s="code">Code<i></i></button></th>
        <th class="num c-resp"><button type="button" class="sortbtn" data-s="response">Response<i></i></button></th>
        <th class="detail">Detail</th><th class="pad"></th>
      </tr></thead>
      <tbody id="rows"></tbody>
    </table>
  </div>
</section>
</main>

${options.embedded ? "" : `<footer>
  <div class="wrap">
    <span id="foot"></span>
    <span class="keys">
      <span><kbd>R</kbd> check now</span>
      <span><kbd>esc</kbd> close</span>
    </span>
  </div>
</footer>`}

<script>
(function () {
  'use strict';
  var TOKEN = ${embedJson$1(token)};
  var POLL_MS = ${pollMs};
  var CAN_CHECK = ${options.canCheck ? "true" : "false"};
  var EMBEDDED = ${options.embedded ? "true" : "false"};
  /** Sent with every message so a board knows which service is asking. */
  var SCOPE = ${embedJson$1(options.scope ?? null)};
  var data = ${embedJson$1(snapshot)};

  /* Report page-side failures to the plugin log; a broken render is otherwise silent. */
  window.addEventListener('error', function (e) {
    post('error', { message: String(e.message) + ' @' + e.lineno + ':' + e.colno });
  });

  function post(type, extra) {
    var body = { type: type };
    if (SCOPE !== null) body.scope = SCOPE;
    if (extra) for (var k in extra) body[k] = extra[k];
    return fetch('/message?t=' + encodeURIComponent(TOKEN), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).catch(function () { return {}; });
  }

  /* ── formatting ──────────────────────────────────────────────────────── */

  function ms(value) {
    if (value === null || value === undefined) return '—';
    if (value >= 10000) return (value / 1000).toFixed(1) + ' s';
    return value + ' ms';
  }

  function clockOf(iso) {
    var d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function dayOf(iso) {
    var d = new Date(iso);
    var today = new Date();
    if (d.toDateString() === today.toDateString()) return '';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function agoOf(iso) {
    var seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return seconds + 's ago';
    if (seconds < 3600) return Math.round(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.round(seconds / 3600) + 'h ago';
    return Math.round(seconds / 86400) + 'd ago';
  }

  /** OK, over the slow threshold, or failed — the only three the chart and table distinguish. */
  function kindOf(check) {
    if (!check.ok) return 'fail';
    if (check.responseTimeMs > data.slowThresholdMs) return 'slow';
    return 'ok';
  }

  var KIND_LABEL = { ok: 'OK', slow: 'Slow', fail: 'Failed' };

  function detailOf(check) {
    if (check.error) return check.error;
    if (check.bodySnippet) return check.bodySnippet;
    if (check.ok) return '';
    return 'Unexpected response';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /* ── header, tiles, table ────────────────────────────────────────────── */

  function paintHeader() {
    // Embedded, the board owns the header and the footer; there is nothing here to paint.
    if (EMBEDDED) return;
    document.getElementById('name').textContent = data.serviceName;
    var pill = document.getElementById('pill');
    pill.setAttribute('data-state', data.state);
    document.getElementById('pill-label').textContent = data.stateLabel;

    var meta = data.endpointUrl || 'No endpoint configured';
    meta += ' · ' + data.checkFrequency;
    if (data.lastCheckedAt) meta += ' · checked ' + agoOf(data.lastCheckedAt);
    document.getElementById('meta').textContent = meta;

    var foot = 'Expects HTTP ' + data.expectedStatusCode
      + ' · timeout ' + ms(data.timeoutMs)
      + ' · slow over ' + ms(data.slowThresholdMs);
    document.getElementById('foot').textContent = foot;
  }

  function tile(label, value, unit, sub) {
    var node = el('div', 'tile');
    node.appendChild(el('h2', 'label', label));
    var v = el('div', 'value', value);
    if (unit) v.appendChild(el('span', 'unit', unit));
    node.appendChild(v);
    node.appendChild(el('div', 'sub', sub));
    return node;
  }

  function paintTiles() {
    var s = data.stats;
    var tiles = document.getElementById('tiles');
    tiles.textContent = '';

    tiles.appendChild(tile(
      'Uptime',
      s.uptimePct === null ? '—' : String(s.uptimePct),
      s.uptimePct === null ? '' : '%',
      s.total ? s.ok + ' of ' + s.total + ' checks' : 'no checks yet'
    ));
    tiles.appendChild(tile(
      'Median response',
      s.median === null ? '—' : String(s.median),
      s.median === null ? '' : 'ms',
      s.latencySamples ? 'across ' + s.latencySamples + ' successful' : 'no successful checks'
    ));
    tiles.appendChild(tile(
      'Slow responses',
      s.total ? String(s.overThreshold) : '—',
      '',
      s.total ? 'over ' + ms(data.slowThresholdMs)
              + (s.slowest === null ? '' : ' · slowest ' + ms(s.slowest))
              : 'no checks yet'
    ));
    tiles.appendChild(tile(
      'Failures in a row',
      String(data.consecutiveFailures),
      '',
      s.failed + ' failed in this window'
    ));
  }

  /*
   * Which rows to show and in what order.
   *
   * Held here rather than read back off the DOM, because the table is rebuilt from scratch every
   * time a check lands — anything kept in the markup would be reset by the next poll.
   */
  var filter = 'all';
  var sortKey = 'time';
  var sortDir = -1;  // -1 newest/slowest first, 1 the other way

  /** Severity order, so ascending reads healthy → slow → failed. */
  var KIND_RANK = { ok: 0, slow: 1, fail: 2 };

  var SORT_LABEL = {
    'time:-1': 'newest first', 'time:1': 'oldest first',
    'response:-1': 'slowest first', 'response:1': 'fastest first',
    'result:-1': 'failures first', 'result:1': 'healthy first',
    'code:-1': 'highest status first', 'code:1': 'lowest status first'
  };

  var EMPTY_FOR = {
    all: 'Nothing recorded yet.',
    healthy: 'No healthy checks in this window.',
    slow: 'No slow responses in this window.',
    failed: 'No failures in this window.'
  };

  function valueFor(check, key) {
    if (key === 'time') return new Date(check.timestamp).getTime();
    if (key === 'response') return check.responseTimeMs;
    if (key === 'result') return KIND_RANK[kindOf(check)];
    return check.statusCode;  // may be null — see the comparator
  }

  function compare(a, b) {
    var x = valueFor(a, sortKey), y = valueFor(b, sortKey);
    // A failure with no status code sorts to the bottom whichever way the column points:
    // "no answer" is not a low number, and floating it to the top would bury the codes.
    if (x === null && y === null) x = y = 0;
    else if (x === null) return 1;
    else if (y === null) return -1;
    if (x !== y) return (x < y ? -1 : 1) * sortDir;
    // Stable within ties, and newest-first is the order to fall back to.
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  }

  function paintFilter() {
    var counts = { all: data.checks.length, healthy: 0, slow: 0, failed: 0 };
    for (var i = 0; i < data.checks.length; i++) {
      var kind = kindOf(data.checks[i]);
      if (kind === 'ok') counts.healthy++;
      else if (kind === 'slow') counts.slow++;
      else counts.failed++;
    }
    var buttons = document.getElementById('filter').children;
    for (var b = 0; b < buttons.length; b++) {
      var name = buttons[b].getAttribute('data-f');
      buttons[b].classList.toggle('on', name === filter);
      buttons[b].querySelector('b').textContent = String(counts[name]);
      // Never disable the filter currently in force, or there is no way back out of it.
      buttons[b].disabled = counts[name] === 0 && name !== filter;
    }
  }

  function paintSortIndicators() {
    var heads = document.querySelectorAll('.sortbtn');
    for (var i = 0; i < heads.length; i++) {
      var key = heads[i].getAttribute('data-s');
      var active = key === sortKey;
      heads[i].querySelector('i').textContent = active ? (sortDir === 1 ? '↑' : '↓') : '';
      heads[i].parentNode.setAttribute('aria-sort',
        active ? (sortDir === 1 ? 'ascending' : 'descending') : 'none');
    }
  }

  function paintTable() {
    var rows = document.getElementById('rows');
    var scroller = document.querySelector('.scroll');
    /*
     * Emptying the tbody collapses the scroller, which drops scrollTop to 0 — so a check landing
     * while you were reading older rows yanked the list back to the top. Captured before the
     * rebuild and restored after it.
     */
    var scrollTop = scroller ? scroller.scrollTop : 0;
    rows.textContent = '';

    paintFilter();
    paintSortIndicators();

    var recent = data.checks.filter(function (check) {
      if (filter === 'all') return true;
      var kind = kindOf(check);
      return filter === 'healthy' ? kind === 'ok'
           : filter === 'slow' ? kind === 'slow'
           : kind === 'fail';
    }).sort(compare);

    var sub = recent.length ? (SORT_LABEL[sortKey + ':' + sortDir] || '') : '';
    if (filter !== 'all' && recent.length) {
      sub = recent.length + ' of ' + data.checks.length + ' · ' + sub;
    }
    document.getElementById('table-sub').textContent = sub;

    // Reserve the Detail column only when a row on screen has something to put in it.
    var anyDetail = false;
    for (var d = 0; d < recent.length; d++) {
      if (detailOf(recent[d])) { anyDetail = true; break; }
    }
    document.getElementById('checks').classList.toggle('has-detail', anyDetail);

    if (!recent.length) {
      var blank = document.createElement('tr');
      // Not class "detail" — that column is hidden when empty, which is exactly this case, and
      // the placeholder would have gone with it.
      var cell = el('td', 'blank', EMPTY_FOR[filter]);
      cell.colSpan = 6;
      blank.appendChild(cell);
      rows.appendChild(blank);
      return;
    }

    for (var i = 0; i < recent.length; i++) {
      var check = recent[i];
      var kind = kindOf(check);
      var tr = document.createElement('tr');

      var day = dayOf(check.timestamp);
      tr.appendChild(el('td', 'c-time', (day ? day + ' ' : '') + clockOf(check.timestamp)));

      var result = el('td', 'result c-result');
      var res = el('span', 'res');
      var dot = el('i', 'dot');
      dot.style.background = 'var(--' + kind + ')';
      res.appendChild(dot);
      res.appendChild(el('span', null, KIND_LABEL[kind]));
      result.appendChild(res);
      tr.appendChild(result);

      tr.appendChild(el('td', 'c-code', check.statusCode === null ? '—' : String(check.statusCode)));
      tr.appendChild(el('td', 'num c-resp', ms(check.responseTimeMs)));
      var detail = el('td', 'detail', detailOf(check));
      detail.title = detailOf(check);
      tr.appendChild(detail);
      tr.appendChild(el('td', 'pad'));

      rows.appendChild(tr);
    }

    if (scroller) scroller.scrollTop = scrollTop;
  }

  (function bindTableControls() {
    document.getElementById('filter').addEventListener('click', function (e) {
      var button = e.target.closest('button[data-f]');
      if (!button) return;
      filter = button.getAttribute('data-f');
      paintTable();
    });

    document.querySelector('thead').addEventListener('click', function (e) {
      var button = e.target.closest('.sortbtn');
      if (!button) return;
      var key = button.getAttribute('data-s');
      // Same column flips direction; a new column starts at the way round that reads first for
      // it — newest, slowest, worst — since that is what anyone clicking it is looking for.
      if (key === sortKey) sortDir = -sortDir;
      else { sortKey = key; sortDir = -1; }
      paintTable();
    });
  })();

  /* ── chart ───────────────────────────────────────────────────────────── */

  // Left pad holds the widest tick label, which carries the unit — "1000 ms" clipped at 46.
  var PAD_L = 58, PAD_R = 14, PAD_T = 10, PAD_B = 20;
  var MAX_BAR = 24, GAP = 2, RADIUS = 4;
  /**
   * The chart always draws the same number of slots the history holds at most, and fills them
   * from the right.
   *
   * Scaling the columns to however many checks exist made seven of them 24px wide and 100px
   * apart, floating in the middle of the plot. Fixed slots keep a column the same width from the
   * first check onwards, and the empty left-hand side honestly says the window is not full yet.
   */
  var SLOTS = 60;

  /** Rounds an axis maximum up to a clean 1/2/5 x 10^n, so ticks read as round numbers. */
  function niceMax(value) {
    if (!(value > 0)) return 100;
    var magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    var scaled = value / magnitude;
    var step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
    return step * magnitude;
  }

  /** A column with a rounded data-end and square feet at the baseline. */
  function barPath(x, y, w, base) {
    var h = base - y;
    var r = Math.min(RADIUS, w / 2, h);
    if (h <= 0) return '';
    if (r <= 0.5) return 'M' + x + ' ' + y + 'h' + w + 'v' + h + 'h' + (-w) + 'Z';
    return 'M' + x + ' ' + base
      + 'V' + (y + r)
      + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + (-r)
      + 'h' + (w - 2 * r)
      + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r
      + 'V' + base + 'Z';
  }

  var geometry = null;  // kept for hit-testing on hover

  function paintChart() {
    var host = document.getElementById('plot');
    var tip = document.getElementById('tip');
    var old = host.querySelector('svg');
    if (old) host.removeChild(old);
    var oldEmpty = host.querySelector('.empty');
    if (oldEmpty) host.removeChild(oldEmpty);

    var checks = data.checks;
    document.getElementById('legend-thresh').textContent = 'slow over ' + ms(data.slowThresholdMs);
    document.getElementById('legend').style.visibility = checks.length ? 'visible' : 'hidden';
    if (!checks.length) {
      geometry = null;
      tip.classList.remove('on');
      var note = el('div', 'empty', CAN_CHECK
        ? 'No checks yet — press Check now to run one.'
        : 'No checks yet.');
      host.appendChild(note);
      document.getElementById('chart-sub').textContent = '';
      return;
    }

    var W = host.clientWidth || ${winW - 64};
    var H = host.clientHeight || 184;
    var plotW = W - PAD_L - PAD_R;
    var plotH = H - PAD_T - PAD_B;
    var base = PAD_T + plotH;

    var oks = [];
    for (var i = 0; i < checks.length; i++) if (checks[i].ok) oks.push(checks[i].responseTimeMs);
    // The threshold is part of the scale so its line is always on screen, even when every check
    // came back far below it.
    var top = niceMax(Math.max(oks.length ? Math.max.apply(null, oks) : 0, data.slowThresholdMs));
    var slots = Math.max(checks.length, SLOTS);
    var band = plotW / slots;
    var barW = Math.max(2, Math.min(MAX_BAR, band - GAP));
    // Newest against the right edge, so the newest check is always in the same place.
    var offset = slots - checks.length;

    function yOf(value) { return PAD_T + plotH - (Math.min(value, top) / top) * plotH; }

    var svg = '';
    // Colours go in a style attribute, never a presentation attribute: var() is substituted for
    // CSS declarations only, so fill="var(--ok)" renders as black.
    var TICK_TEXT = 'style="fill:var(--fg-dim);font-variant-numeric:tabular-nums" font-size="10"';
    var LABEL_TEXT = 'style="fill:var(--fg-dim)" font-size="10"';

    // Gridlines: solid hairlines one step off the surface, carrying the values the columns are
    // not directly labelled with.
    var ticks = [0, 0.25, 0.5, 0.75, 1];
    for (var t = 0; t < ticks.length; t++) {
      var value = top * ticks[t];
      var y = yOf(value);
      svg += '<line x1="' + PAD_L + '" y1="' + y + '" x2="' + (W - PAD_R) + '" y2="' + y
        + '" style="stroke:var(--' + (ticks[t] === 0 ? 'card-line' : 'line') + ');stroke-width:1" />';
      // The unit rides the top tick rather than a separate label, which collided with it. Long
      // axes go to thousands so the label cannot outgrow the left pad.
      var tick = value >= 10000 ? Math.round(value / 1000) + 'k' : String(Math.round(value));
      svg += '<text x="' + (PAD_L - 8) + '" y="' + (y + 4) + '" text-anchor="end" ' + TICK_TEXT
        + '>' + tick + (ticks[t] === 1 ? ' ms' : '') + '</text>';
    }

    // The slow threshold. Dashed, because it is a threshold and not a gridline. Its value is
    // named in the legend, where no column can ever be drawn over the words.
    var ty = yOf(data.slowThresholdMs);
    svg += '<line x1="' + PAD_L + '" y1="' + ty + '" x2="' + (W - PAD_R) + '" y2="' + ty
      + '" style="stroke:var(--slow);stroke-width:1.25;stroke-dasharray:4 4;opacity:.75" />';

    // Hover cursor sits behind the columns so it never tints them.
    svg += '<rect id="cursor" x="0" y="' + PAD_T + '" width="0" height="' + plotH
      + '" style="fill:var(--hover)" rx="3" />';

    for (var c = 0; c < checks.length; c++) {
      var check = checks[c];
      var x = PAD_L + (offset + c) * band + (band - barW) / 2;
      var kind = kindOf(check);
      if (kind === 'fail') {
        /*
         * A failure has no response time worth plotting — a refused connection comes back in
         * three milliseconds, which as a column would read as the fastest check on the chart. So
         * it is drawn filled to full height instead.
         *
         * That carries the meaning on its own: it is the only mark that ever reaches the top, so
         * the cue survives greyscale, forced-colors and any colour blindness, and the legend and
         * the table's Failed label do the naming. An earlier version outlined the column and put
         * a cross at the cap — both were needed to make a hollow rectangle read as a failure
         * rather than as a gap, and both became noise once it was filled.
         */
        svg += '<rect x="' + x + '" y="' + PAD_T + '" width="' + barW + '" height="' + plotH
          + '" rx="2" style="fill:var(--fail)" />';
      } else {
        var y = yOf(check.responseTimeMs);
        svg += '<path d="' + barPath(x, y, barW, base) + '" style="fill:var(--' + kind + ')" />';
      }
    }

    // Selective x labels: the ends of the window, which is what orients the reader. Everything
    // else is one hover or one table row away.
    // Under the first column it belongs to, not at the axis origin, which on a part-full window
    // would put the oldest check's time a long way from the oldest check. Dropped entirely when
    // the two ends are close enough for the labels to overlap — a handful of checks span a few
    // minutes, and two times printed over each other are worse than one.
    var firstX = PAD_L + offset * band;
    if ((W - PAD_R) - firstX > 150) {
      svg += '<text x="' + firstX + '" y="' + (H - 5) + '" ' + LABEL_TEXT + '>'
        + clockOf(checks[0].timestamp) + '</text>';
    }
    svg += '<text x="' + (W - PAD_R) + '" y="' + (H - 5) + '" text-anchor="end" ' + LABEL_TEXT
      + '>' + clockOf(checks[checks.length - 1].timestamp) + '</text>';

    var node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label',
      'Response time of the last ' + checks.length + ' checks. '
      + 'Full values are listed in the recent checks table below.');
    node.innerHTML = svg;
    host.insertBefore(node, tip);

    geometry = { band: band, count: checks.length, offset: offset, left: PAD_L, W: W };
    document.getElementById('chart-sub').textContent =
      'last ' + checks.length + (checks.length === 1 ? ' check' : ' checks');
  }

  /* ── hover ───────────────────────────────────────────────────────────── */

  function indexAt(clientX) {
    var host = document.getElementById('plot');
    if (!geometry) return -1;
    var rect = host.getBoundingClientRect();
    // The SVG is stretched to the element's box, so page pixels and viewBox units differ.
    var scale = geometry.W / rect.width;
    var x = (clientX - rect.left) * scale;
    if (x < geometry.left || x > geometry.W) return -1;
    // Empty slots on the left of a part-full window answer -1 rather than the oldest check.
    var index = Math.floor((x - geometry.left) / geometry.band) - geometry.offset;
    return index >= 0 && index < geometry.count ? index : -1;
  }

  function showTip(index, clientX) {
    var host = document.getElementById('plot');
    var tip = document.getElementById('tip');
    var cursor = host.querySelector('#cursor');
    var check = data.checks[index];
    if (!check) return hideTip();

    var kind = kindOf(check);
    tip.textContent = '';
    var head = el('div', 't-head');
    var dot = el('i', 'dot');
    dot.style.background = 'var(--' + kind + ')';
    dot.style.width = '8px'; dot.style.height = '8px'; dot.style.borderRadius = '50%';
    dot.style.display = 'inline-block';
    head.appendChild(dot);
    var day = dayOf(check.timestamp);
    head.appendChild(el('span', null, KIND_LABEL[kind] + ' · ' + (day ? day + ' ' : '') + clockOf(check.timestamp)));
    tip.appendChild(head);
    tip.appendChild(el('div', 't-row',
      (check.statusCode === null ? 'no response' : 'HTTP ' + check.statusCode)
      + ' · ' + ms(check.responseTimeMs)));
    var detail = detailOf(check);
    if (detail) tip.appendChild(el('div', 't-err', detail));

    if (cursor) {
      cursor.setAttribute('x', String(geometry.left + (geometry.offset + index) * geometry.band));
      cursor.setAttribute('width', String(geometry.band));
    }

    tip.classList.add('on');
    var rect = host.getBoundingClientRect();
    var x = clientX - rect.left;
    var width = tip.offsetWidth;
    // Keep it inside the plot rather than letting it spill past the card edge.
    tip.style.left = Math.max(0, Math.min(x - width / 2, rect.width - width)) + 'px';
    tip.style.top = '6px';
  }

  function hideTip() {
    var tip = document.getElementById('tip');
    tip.classList.remove('on');
    var cursor = document.querySelector('#cursor');
    if (cursor) cursor.setAttribute('width', '0');
  }

  /** Where the pointer last was over the plot, so a repaint can re-resolve what it points at. */
  var hoverX = null;

  (function bindHover() {
    var host = document.getElementById('plot');
    host.addEventListener('mousemove', function (e) {
      hoverX = e.clientX;
      var index = indexAt(e.clientX);
      if (index < 0) return hideTip();
      showTip(index, e.clientX);
    });
    host.addEventListener('mouseleave', function () {
      hoverX = null;
      hideTip();
    });
  })();

  /**
   * Puts the tooltip back over whatever is now under the pointer.
   *
   * The chart's SVG is replaced wholesale on every repaint, so an open tooltip was left showing
   * the previous render's text — and pointing at a column that had shifted, since a new check
   * moves every one of them left by a slot. Re-resolving from the pointer position rather than
   * from the old index is what keeps it honest.
   */
  function restoreTip() {
    if (hoverX === null || !document.getElementById('tip').classList.contains('on')) return;
    var index = indexAt(hoverX);
    if (index < 0) hideTip();
    else showTip(index, hoverX);
  }

  /* ── painting and refresh ────────────────────────────────────────────── */

  function paint() {
    paintHeader();
    paintTiles();
    paintChart();
    paintTable();
    restoreTip();
  }

  /**
   * What a repaint is worth doing for.
   *
   * The snapshot is rebuilt on every poll, so it always differs by its own timestamp. Repainting
   * on that alone would rebuild the table twice a second underneath the cursor and drop any
   * text selection with it.
   */
  function signature(d) {
    return [d.state, d.lastCheckedAt, d.checks.length, d.consecutiveFailures,
            d.serviceName, d.endpointUrl, d.slowThresholdMs, d.stats.ok].join('|');
  }
  var lastSignature = signature(data);

  function apply(next) {
    if (!next) return;
    var changed = signature(next) !== lastSignature;
    data = next;
    lastSignature = signature(next);
    if (changed) paint();
    else paintHeader();  // the relative "checked 40s ago" still moves on
  }

  var checking = false;
  function runCheck() {
    if (!CAN_CHECK || checking) return;
    checking = true;
    var button = document.getElementById('check');
    // The label is its own element: setting textContent on the button would take the icon with
    // it, and it would not come back.
    var label = document.getElementById('check-label');
    if (button) { button.disabled = true; label.textContent = 'Checking…'; }
    post('check').then(function (reply) {
      apply(reply.data);
    }).then(function () {
      checking = false;
      if (button) { button.disabled = false; label.textContent = 'Check now'; }
    });
  }

  if (CAN_CHECK) {
    document.getElementById('check').addEventListener('click', runCheck);
  }

  document.addEventListener('keydown', function (e) {
    // Embedded, closing is the host window's business: this page's Escape would otherwise
    // shut the whole board.
    if (e.key === 'Escape' && !EMBEDDED) { post('close'); window.close(); return; }
    if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) runCheck();
  });

  /*
   * Two separate clocks.
   *
   * Polling must not hold the window open, or the idle timeout can never fire and a forgotten
   * window lives forever. So the poll is a plain read, and only real interaction pings.
   */
  setInterval(function () {
    if (checking) return;
    post('poll').then(function (reply) { apply(reply.data); });
  }, POLL_MS);

  var lastPing = 0;
  function touch() {
    var now = Date.now();
    if (now - lastPing < 5000) return;
    lastPing = now;
    post('ping');
  }
  document.addEventListener('keydown', touch, true);
  document.addEventListener('pointerdown', touch, true);
  document.addEventListener('wheel', touch, true);

  // Same reasoning: an embedded frame unloads whenever the selection changes, which must not
  // be reported as the window closing.
  if (!EMBEDDED) {
    window.addEventListener('beforeunload', function () { post('close'); });
  }
  window.addEventListener('resize', function () { paintChart(); });

  paint();
})();
</script>
</body>
</html>`;
}
/**
 * Shows the history window and resolves when it closes.
 *
 * The server, the token gate, the host spawn and the launch/close distinction all live in
 * `windowHost`; what is left here is the page and the two messages this window has of its own.
 */
async function showHistoryWindow(hostPath, options) {
    return serveWindow(hostPath, {
        width: options.width ?? WINDOW_WIDTH$1,
        height: options.height ?? WINDOW_HEIGHT$1,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS$1,
        onWarn: options.onWarn,
        onOpen: options.onOpen,
        renderPage: (token) => renderHistoryHtml(options.getSnapshot(), token, {
            width: options.width ?? WINDOW_WIDTH$1,
            height: options.height ?? WINDOW_HEIGHT$1,
            canCheck: !!options.onRunCheck,
        }),
        onMessage: async (message) => {
            // A read, deliberately not an interaction: see the page's comment about the two clocks.
            if (message.type === "poll")
                return { data: options.getSnapshot() };
            if (message.type === "check") {
                const run = options.onRunCheck;
                if (run) {
                    try {
                        await run();
                    }
                    catch (error) {
                        // The window stays up and shows whatever the key holds; a failed manual check is
                        // already visible as the key's state.
                        options.onWarn?.(`history window check failed: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
                return { data: options.getSnapshot() };
            }
            return {};
        },
    });
}

/** States that describe a settled reading, as against "not checked" and "being checked". */
const SETTLED = ["healthy", "slow", "warning", "down"];
const FAILING = ["warning", "down"];
/**
 * The state a service should be in, given what just happened and where it has been.
 *
 * Both directions are damped, and neither used to be quite right:
 *
 * - **Into trouble.** `amberAfterFailures` was configured, inherited and validated, and never
 *   read: any failure returned `warning` and only `down` had a threshold. Below the amber count a
 *   failure now holds the previous state rather than raising one, which is what the setting always
 *   claimed. Holding rather than returning "healthy" matters on the way back down too, or a
 *   service that was down, passed once and failed again would be promoted to healthy by failing.
 *
 * - **Out of it.** One success used to clear an outage outright, so a service alternating pass and
 *   fail alternated green and red on every round. `recoverAfterSuccesses` is the count of
 *   consecutive successes needed before a failing service is believed again. It defaults to 1,
 *   which is exactly the old behaviour.
 *
 * Recovery gates `warning` and `down` only. `slow` is a level read off the latest latency rather
 * than a fault, and one counter cannot serve both: a slow check is a success, so counting it as
 * recovery would let a still-slow service call itself healthy, and not counting it would strand a
 * service that recovered from an outage into merely being slow.
 */
function evaluateButtonState(settings, inputs) {
    const { consecutiveFailures, consecutiveSuccesses, previousState, lastRecord } = inputs;
    if (!lastRecord)
        return "unknown";
    if (!lastRecord.ok) {
        if (consecutiveFailures >= settings.redAfterFailures)
            return "down";
        if (consecutiveFailures >= settings.amberAfterFailures)
            return "warning";
        // Not enough failures to call it. Nothing changes, in either direction. A first-ever check
        // that fails has no previous state to hold, and "unknown" would read as never checked.
        return SETTLED.includes(previousState) ? previousState : "warning";
    }
    // A success does not clear a failure on its own. The latency of this check is still recorded;
    // it simply does not get to decide the state yet.
    if (FAILING.includes(previousState) && consecutiveSuccesses < settings.recoverAfterSuccesses) {
        return previousState;
    }
    if (lastRecord.responseTimeMs > settings.slowThresholdMs)
        return "slow";
    return "healthy";
}
function buildCheckRecord(result, state) {
    return {
        timestamp: new Date().toISOString(),
        ok: result.ok,
        state,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        bodyMatched: result.bodyMatched,
        bodySnippet: result.bodySnippet,
        error: result.error,
    };
}
function validateSettings(settings) {
    if (!settings.endpointUrl || settings.endpointUrl.trim() === "") {
        return "Endpoint URL is required";
    }
    try {
        const url = new URL(settings.endpointUrl.trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return "URL must use http:// or https://";
        }
    }
    catch {
        return "Invalid URL format";
    }
    if (settings.redAfterFailures < settings.amberAfterFailures) {
        return "Red threshold must be >= amber threshold";
    }
    if (settings.recoverAfterSuccesses < 1) {
        return "Recovery threshold must be at least 1";
    }
    return null;
}

const FREQUENCY_MS = {
    manual: null,
    "1m": 60_000,
    "5m": 300_000,
    "10m": 600_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
};
function getIntervalMs(frequency) {
    return FREQUENCY_MS[frequency] ?? null;
}
function startTimer(intervalMs, callback) {
    return setInterval(callback, intervalMs);
}
/**
 * How long until a key is next due a check, given when it last had one.
 *
 * `willAppear` fires far more often than people expect: every time a folder is opened or closed,
 * a profile switches, or the Stream Deck app redraws its pages. Each one used to schedule a check
 * a second and a half later regardless of when the last one ran, so walking in and out of a folder
 * five times ran five extra checks — wasted requests against someone else's service, and five
 * slots gone from a 60-record window that on an hourly key is meant to cover two and a half days.
 *
 * So the schedule is anchored to the last check rather than to the moment the key appeared: a key
 * checked 50 minutes ago on an hourly interval waits the remaining 10 minutes, and one that has
 * never been checked, or is overdue, goes after the short settling delay.
 *
 * @param minDelayMs A floor on the answer, so a check never fires while the plugin is still
 * starting up and the key has not finished drawing.
 */
function msUntilDue(lastCheckedAt, intervalMs, minDelayMs) {
    if (!lastCheckedAt)
        return minDelayMs;
    const last = Date.parse(lastCheckedAt);
    // An unparseable timestamp is treated as no timestamp rather than as the epoch, which would
    // read as wildly overdue and check immediately every time.
    if (!Number.isFinite(last))
        return minDelayMs;
    // A clock that has gone backwards, or a timestamp from the future, must not park a key for
    // hours: anything that is not a sane elapsed time falls back to checking now.
    const elapsed = Date.now() - last;
    if (elapsed < 0 || elapsed >= intervalMs)
        return minDelayMs;
    return Math.max(minDelayMs, intervalMs - elapsed);
}
function clearTimer(timer) {
    if (timer !== null)
        clearInterval(timer);
}

const ICON_PATH = {
    healthy: "imgs/actions/healthcheck/success",
    slow: "imgs/actions/healthcheck/warn",
    warning: "imgs/actions/healthcheck/warn",
    down: "imgs/actions/healthcheck/failure",
    checking: "imgs/actions/healthcheck/loading",
    unknown: "imgs/actions/healthcheck/config",
    "config-error": "imgs/actions/healthcheck/config",
};
function getIcon(state) {
    return ICON_PATH[state] ?? ICON_PATH["unknown"];
}

const LONG_PRESS_MS$1 = 500;
const INITIAL_CHECK_DELAY_MS$1 = 1500;
let HealthCheckAction = (() => {
    let _classDecorators = [action({ UUID: "com.glenmorgan.pulsedeck.healthcheck" })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = SingletonAction;
    (class extends _classSuper {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        instances = new Map();
        // ── Lifecycle ────────────────────────────────────────────────────────────
        async onWillAppear(ev) {
            if (!ev.action.isKey())
                return;
            const keyAction = ev.action;
            const id = keyAction.id;
            const settings = mergeWithDefaults(ev.payload.settings);
            const instance = {
                actionId: id,
                settings,
                isChecking: false,
                keyDownAt: null,
                timer: null,
                dueTimer: null,
                closeWindow: null,
            };
            this.instances.set(id, instance);
            const initialState = validateSettings(settings)
                ? "config-error"
                : settings.currentState;
            await renderState(keyAction, initialState, settings);
            this.resetTimer(id, keyAction);
        }
        async onWillDisappear(ev) {
            const id = ev.action.id;
            const instance = this.instances.get(id);
            if (instance) {
                clearTimer(instance.timer);
                if (instance.dueTimer)
                    clearTimeout(instance.dueTimer);
                // A window outlives its key otherwise: the page would keep polling a snapshot that has
                // stopped moving, and Check now would silently do nothing.
                instance.closeWindow?.();
                this.instances.delete(id);
            }
        }
        async onDidReceiveSettings(ev) {
            if (!ev.action.isKey())
                return;
            const keyAction = ev.action;
            const id = keyAction.id;
            const settings = mergeWithDefaults(ev.payload.settings);
            const instance = this.instances.get(id);
            if (!instance)
                return;
            instance.settings = settings;
            this.resetTimer(id, keyAction);
            await renderState(keyAction, settings.currentState, settings);
        }
        // ── Key press ────────────────────────────────────────────────────────────
        onKeyDown(ev) {
            const instance = this.instances.get(ev.action.id);
            if (instance)
                instance.keyDownAt = Date.now();
        }
        async onKeyUp(ev) {
            if (!ev.action.isKey())
                return;
            const id = ev.action.id;
            const instance = this.instances.get(id);
            if (!instance)
                return;
            const pressDuration = instance.keyDownAt !== null
                ? Date.now() - instance.keyDownAt
                : 0;
            instance.keyDownAt = null;
            /*
             * Short press opens the history; holding checks now. The same way round as the board key.
             *
             * These were the other way round until the board arrived, and two keys from one plugin
             * disagreeing about what a press means is worse than either mapping. Looking is also the
             * safer thing to do by accident: a stray tap opens a window, rather than sending a request to
             * somebody else's service.
             */
            if (pressDuration >= LONG_PRESS_MS$1) {
                await this.triggerCheck(id, ev.action);
                return;
            }
            // Deliberately not awaited: the window stays open until it is closed, and awaiting it here
            // would hold the key's event handler for as long as someone is reading the chart.
            void this.openHistory(id, ev.action);
        }
        // ── History window ────────────────────────────────────────────────────────
        /**
         * Opens the history window, working down the available hosts.
         *
         * A host can be present yet fail to launch — an unsigned native host that Gatekeeper
         * quarantined is the usual cause — so a failure tries the next one rather than being mistaken
         * for the user closing the window. With no host at all, the osascript dialog still shows the
         * same figures as text.
         */
        async openHistory(id, keyAction) {
            const instance = this.instances.get(id);
            if (!instance)
                return;
            // A second long press while the window is up must not open a second copy of it. Claimed
            // before the first await, since finding a host and starting the server take long enough for
            // another press to arrive; the real closer replaces this as soon as a host is spawned.
            if (instance.closeWindow)
                return;
            instance.closeWindow = () => { };
            try {
                for (const host of await findHosts()) {
                    try {
                        await showHistoryWindow(host, {
                            // Read from the instance rather than captured settings, so a background check that
                            // lands while the window is open shows up on the next poll.
                            getSnapshot: () => buildSnapshot(instance.settings),
                            onRunCheck: () => this.triggerCheck(id, keyAction),
                            onOpen: (close) => { instance.closeWindow = close; },
                            onWarn: (message) => streamDeck.logger.warn(message),
                        });
                        return;
                    }
                    catch (error) {
                        streamDeck.logger.warn("History window host unavailable, trying the next one:", error);
                    }
                }
                streamDeck.logger.info("No window host available; falling back to the osascript dialog");
                const text = formatHistoryPopup(instance.settings.serviceName, instance.settings.currentState, instance.settings.consecutiveFailures, instance.settings.history);
                // execSync blocks the plugin's event loop, so it must not run in the key handler's turn.
                setTimeout(() => showPopup(text), 0);
            }
            finally {
                instance.closeWindow = null;
            }
        }
        // ── Check execution ───────────────────────────────────────────────────────
        async triggerCheck(id, keyAction) {
            const instance = this.instances.get(id);
            if (!instance)
                return;
            if (instance.isChecking)
                return;
            const validationError = validateSettings(instance.settings);
            if (validationError) {
                instance.settings.currentState = "config-error";
                await renderState(keyAction, "config-error", instance.settings);
                return;
            }
            instance.isChecking = true;
            instance.settings.currentState = "checking";
            await renderState(keyAction, "checking", instance.settings);
            let result;
            try {
                result = await runHealthCheck(instance.settings);
            }
            finally {
                instance.isChecking = false;
            }
            // Captured before the counters move, because the recovery threshold is judged against where
            // the service was, not where this check is about to put it.
            const previousState = instance.settings.currentState;
            if (result.ok) {
                instance.settings.consecutiveFailures = 0;
                instance.settings.consecutiveSuccesses = (instance.settings.consecutiveSuccesses ?? 0) + 1;
            }
            else {
                instance.settings.consecutiveFailures += 1;
                instance.settings.consecutiveSuccesses = 0;
            }
            const tempRecord = {
                timestamp: new Date().toISOString(),
                ok: result.ok,
                state: "unknown",
                statusCode: result.statusCode,
                responseTimeMs: result.responseTimeMs,
                bodyMatched: result.bodyMatched,
                bodySnippet: result.bodySnippet,
                error: result.error,
            };
            const newState = evaluateButtonState(instance.settings, {
                consecutiveFailures: instance.settings.consecutiveFailures,
                consecutiveSuccesses: instance.settings.consecutiveSuccesses,
                previousState,
                lastRecord: tempRecord,
            });
            const record = buildCheckRecord(result, newState);
            instance.settings.history = appendRecord(instance.settings.history, record);
            instance.settings.currentState = newState;
            instance.settings.lastCheckedAt = record.timestamp;
            instance.settings.lastStatusCode = result.statusCode;
            instance.settings.lastResponseTimeMs = result.responseTimeMs;
            await renderState(keyAction, newState, instance.settings);
            await keyAction.setSettings(instance.settings);
        }
        // ── Timer management ──────────────────────────────────────────────────────
        /**
         * Schedules the next check from when the *last* one ran, not from now.
         *
         * This runs on every willAppear, and willAppear fires whenever a folder is opened, a profile
         * switches, or the app redraws its pages — none of which are reasons to check a service. The
         * first check is put at whatever remains of the interval, so returning to a page five times
         * costs nothing, and a key that is genuinely due still goes almost immediately.
         */
        resetTimer(id, keyAction) {
            const instance = this.instances.get(id);
            if (!instance)
                return;
            clearTimer(instance.timer);
            instance.timer = null;
            if (instance.dueTimer)
                clearTimeout(instance.dueTimer);
            instance.dueTimer = null;
            const intervalMs = getIntervalMs(instance.settings.checkFrequency);
            if (intervalMs === null)
                return;
            const dueIn = msUntilDue(instance.settings.lastCheckedAt, intervalMs, INITIAL_CHECK_DELAY_MS$1);
            instance.dueTimer = setTimeout(() => {
                instance.dueTimer = null;
                void this.triggerCheck(id, keyAction);
                // The repeating clock starts once the key is back on schedule, so the interval is measured
                // from a real check rather than from whenever the key happened to appear.
                instance.timer = startTimer(intervalMs, () => {
                    void this.triggerCheck(id, keyAction);
                });
            }, dueIn);
        }
    });
    return _classThis;
})();
// ── Module-level helpers ───────────────────────────────────────────────────
function mergeWithDefaults(saved) {
    const base = { ...DEFAULT_SETTINGS, ...saved };
    // sdpi-components saves all text field values as strings; coerce numeric fields back
    return {
        ...base,
        expectedStatusCode: Number(base.expectedStatusCode) || DEFAULT_SETTINGS.expectedStatusCode,
        timeoutMs: Number(base.timeoutMs) || DEFAULT_SETTINGS.timeoutMs,
        slowThresholdMs: Number(base.slowThresholdMs) || DEFAULT_SETTINGS.slowThresholdMs,
        amberAfterFailures: Number(base.amberAfterFailures) || DEFAULT_SETTINGS.amberAfterFailures,
        redAfterFailures: Number(base.redAfterFailures) || DEFAULT_SETTINGS.redAfterFailures,
        recoverAfterSuccesses: Number(base.recoverAfterSuccesses) || DEFAULT_SETTINGS.recoverAfterSuccesses,
    };
}
// ── Module-level rendering helpers ─────────────────────────────────────────
async function renderState(keyAction, state, settings) {
    const icon = getIcon(state);
    const title = buildTitle(state, settings);
    await Promise.all([keyAction.setImage(icon), keyAction.setTitle(title)]);
}
function truncateName(name, max = 10) {
    if (!name)
        return "";
    return name.length > max ? name.slice(0, max - 1) + "…" : name;
}
function buildTitle(state, settings) {
    const name = truncateName(settings.serviceName);
    const ms = settings.lastResponseTimeMs;
    switch (state) {
        case "healthy": return `${name}\nOK\n${ms ?? ""}ms`;
        case "slow": return `${name}\nSlow\n${ms ?? ""}ms`;
        case "warning": return `${name}\nWarn\n${settings.consecutiveFailures} fail`;
        case "down": return `${name}\nDown\n${settings.consecutiveFailures} fail`;
        case "checking": return `${name}\nChecking`;
        case "config-error": return `Setup\nNeeded`;
        default: return `${name}\n—`;
    }
}

/**
 * Twelve services, three across, so a full board is a 3×4.
 *
 * Sixteen was built and rejected. Cell area is the face divided by the count however the grid is
 * turned, so a 4×4 cell came out around 14×14 device pixels on the key against the 3×4's 20×14,
 * and it cost the third column that everything above depends on. Twelve is also where the window
 * stops having to shrink a card to fit.
 */
const BOARD_CAPACITY = 12;
const SIZE = 144;
/** A board with nothing on it: there is no count to fit a grid to, so it keeps the old 3×3. */
const EMPTY_GRID = { cols: 3, rows: 3 };
/**
 * One colour per state the key can usefully tell apart: green, yellow, orange, red, grey.
 *
 * Warning used to share red with down, and the reason was measured rather than assumed: with slow
 * at #fab219 and warning at an orange of the same lightness, the two sat 15 degrees of hue apart
 * with nothing else separating them, and at cell size that was guesswork. Dropping warning into
 * red was the cheap fix.
 *
 * The window's palette then moved both of them: slow toward a true yellow and up in lightness,
 * warning toward red and down in lightness, about 25 degrees and 11 points apart. That is the pair
 * that failed before, separated on two axes instead of one, so the key can carry it now and the
 * two surfaces of the plugin agree about what a warning looks like.
 *
 * Warning and down are still the pair to watch here: they differ by hue and by lightness, but a
 * cell is 20×14 device pixels on the hardware and the window is where a failing service says how
 * long it has been failing.
 *
 * `checking` sits with the greys rather than getting a colour of its own: a key image is a still,
 * and the state lasts a few hundred milliseconds.
 */
const CELL_FILL = {
    healthy: "#29bd50",
    // These three are the window's --slow, --warn and --fail verbatim. Two surfaces of one plugin
    // disagreeing about what a state looks like is worse than any choice either could make alone.
    slow: "#f0cc35",
    warning: "#d1621b",
    down: "#d03b3b",
    checking: "#5a5a5a",
    unknown: "#4a4a4a",
    "config-error": "#4a4a4a",
    empty: "#242424",
};
/** Unfilled slots read as an outline rather than a filled cell, so they are not a state. */
const CELL_STROKE = {
    empty: "#333333",
};
/** Columns and rows for a count of services, with the spacing that suits them. */
function gridFor(count) {
    const { cols, rows } = shapeFor(count);
    // Four *either way*: a 3×4 is as tight as a 4×3, and at the roomier spacing the padding and the
    // corner radius eat about a fifth of what is left to colour. Keyed off columns alone this was
    // dead code under the old square rule, and wrong the moment the grid could be taller than wide.
    const tight = cols >= 4 || rows >= 4;
    return { cols, rows, pad: tight ? 8 : 10, gap: tight ? 5 : 8 };
}
function shapeFor(count) {
    if (count <= 0)
        return { ...EMPTY_GRID };
    // Two and three are bars across the full width, not halves side by side. At key size a wide bar
    // is the more legible shape, and it is the one that reads as "this is all of them".
    if (count <= 3)
        return { cols: 1, rows: count };
    // Four is the one count that earns its own shape: three across would draw it as a row of three
    // and a lone cell with two spares, where a 2×2 fills the face. It costs one re-lay at the fifth
    // service, which is early enough that the board is still readable by name.
    if (count === 4)
        return { cols: 2, rows: 2 };
    return { cols: 3, rows: Math.ceil(count / 3) };
}
/** SVG takes floats, but two decimals keeps the markup readable when something looks wrong. */
function round2(n) {
    return Math.round(n * 100) / 100;
}
function renderBoardIcon(cells) {
    const shown = cells.slice(0, BOARD_CAPACITY);
    const { cols, rows, pad, gap } = gridFor(shown.length);
    // Counts that do not divide into their grid (5, 7, 10, 13) leave the remainder as outlines,
    // which is the same slot the empty board is made of. Centring the short row instead was tried
    // and is worse on the thing that matters more than balance: filling a spare slot moves nothing,
    // where re-centring a row shifts every cell already in it.
    const slots = [...shown];
    while (slots.length < cols * rows)
        slots.push("empty");
    const cellW = (SIZE - pad * 2 - gap * (cols - 1)) / cols;
    const cellH = (SIZE - pad * 2 - gap * (rows - 1)) / rows;
    // Scaled off the cell rather than fixed, or the radius that suits a 36px square swallows a 28px
    // one and rounds a full-face cell into a lozenge. Lands on 7 for a 3×3, which is where it was.
    const radius = Math.max(4, Math.min(14, Math.round(Math.min(cellW, cellH) / 5)));
    let rects = "";
    for (let i = 0; i < slots.length; i++) {
        const x = round2(pad + (i % cols) * (cellW + gap));
        const y = round2(pad + Math.floor(i / cols) * (cellH + gap));
        const state = slots[i];
        const stroke = CELL_STROKE[state];
        rects += `<rect x="${x}" y="${y}" width="${round2(cellW)}" height="${round2(cellH)}"`
            + ` rx="${radius}"`
            + ` fill="${CELL_FILL[state]}"`
            + (stroke ? ` stroke="${stroke}" stroke-width="2"` : "")
            + ` />`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"`
        + ` viewBox="0 0 ${SIZE} ${SIZE}">`
        + `<rect width="${SIZE}" height="${SIZE}" fill="#1c1c1c" />`
        + rects
        + `</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

const DEFAULT_BOARD_DEFAULTS = {
    checkFrequency: "5m",
    expectedStatusCode: 200,
    timeoutMs: 5000,
    slowThresholdMs: 1000,
    amberAfterFailures: 1,
    redAfterFailures: 3,
    // 1 is what the board did before this existed, so a saved board is unaffected.
    recoverAfterSuccesses: 1,
    expectedBodyContains: "",
    showBodySnippetInHistory: false,
    headers: [],
};
const DEFAULT_BOARD_SETTINGS = {
    boardName: "Health board",
    defaults: DEFAULT_BOARD_DEFAULTS,
    services: [],
    runtime: {},
};
const EMPTY_RUNTIME = {
    history: [],
    currentState: "unknown",
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    lastCheckedAt: null,
    lastStatusCode: null,
    lastResponseTimeMs: null,
};

/**
 * Pure board logic: merging, normalising and reading. Everything here is a function of settings,
 * so the parts that decide what gets checked and what the key shows are testable without a
 * Stream Deck, a network, or a clock.
 */
/** Ids only have to be unique within one key's settings, so this is enough. */
function newServiceId() {
    return `svc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function newService(name, url) {
    return {
        id: newServiceId(),
        name,
        url,
        expectedStatusCode: null,
        timeoutMs: null,
        slowThresholdMs: null,
        amberAfterFailures: null,
        redAfterFailures: null,
        recoverAfterSuccesses: null,
        expectedBodyContains: null,
        showBodySnippetInHistory: null,
        headers: null,
    };
}
/** `undefined` and `null` both mean "inherit"; 0 and "" are deliberate values and are kept. */
function inherit(override, fallback) {
    return override === null || override === undefined ? fallback : override;
}
/**
 * Flattens a service onto the board's defaults, producing exactly the settings shape the existing
 * single-endpoint modules already take.
 *
 * That is the point: `runHealthCheck`, `evaluateButtonState` and `buildSnapshot` are reused
 * unchanged, so a board service and a Health Check key are checked and judged by the same code.
 */
function resolveService(defaults, service, runtime = EMPTY_RUNTIME) {
    return {
        ...DEFAULT_SETTINGS,
        serviceName: service.name,
        endpointUrl: service.url,
        checkFrequency: defaults.checkFrequency,
        expectedStatusCode: num(inherit(service.expectedStatusCode, defaults.expectedStatusCode), DEFAULT_BOARD_DEFAULTS.expectedStatusCode),
        timeoutMs: num(inherit(service.timeoutMs, defaults.timeoutMs), DEFAULT_BOARD_DEFAULTS.timeoutMs),
        slowThresholdMs: num(inherit(service.slowThresholdMs, defaults.slowThresholdMs), DEFAULT_BOARD_DEFAULTS.slowThresholdMs),
        amberAfterFailures: num(inherit(service.amberAfterFailures, defaults.amberAfterFailures), DEFAULT_BOARD_DEFAULTS.amberAfterFailures),
        redAfterFailures: num(inherit(service.redAfterFailures, defaults.redAfterFailures), DEFAULT_BOARD_DEFAULTS.redAfterFailures),
        recoverAfterSuccesses: num(inherit(service.recoverAfterSuccesses, defaults.recoverAfterSuccesses), DEFAULT_BOARD_DEFAULTS.recoverAfterSuccesses),
        expectedBodyContains: inherit(service.expectedBodyContains, defaults.expectedBodyContains),
        headers: inherit(service.headers, defaults.headers) ?? [],
        showBodySnippetInHistory: inherit(service.showBodySnippetInHistory, defaults.showBodySnippetInHistory),
        history: runtime.history ?? [],
        currentState: runtime.currentState ?? "unknown",
        consecutiveFailures: runtime.consecutiveFailures ?? 0,
        consecutiveSuccesses: runtime.consecutiveSuccesses ?? 0,
        lastCheckedAt: runtime.lastCheckedAt ?? null,
        lastStatusCode: runtime.lastStatusCode ?? null,
        lastResponseTimeMs: runtime.lastResponseTimeMs ?? null,
    };
}
/** Settings arrive from JSON and from inspector fields, which save numbers as strings. */
function num(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
/**
 * Fills in anything a saved board is missing.
 *
 * Settings written by an older build, or by hand, can be missing whole branches — and a board
 * whose `runtime` is undefined would throw on the first check rather than simply having no
 * history yet.
 */
function mergeBoardSettings(saved) {
    const services = Array.isArray(saved?.services) ? saved.services : [];
    const runtime = saved?.runtime ?? {};
    return {
        ...DEFAULT_BOARD_SETTINGS,
        boardName: saved?.boardName || DEFAULT_BOARD_SETTINGS.boardName,
        defaults: { ...DEFAULT_BOARD_DEFAULTS, ...(saved?.defaults ?? {}) },
        services,
        // Runtime for services that no longer exist is dropped here rather than accumulating
        // forever; an undo that restores a service restores its runtime alongside it.
        runtime: Object.fromEntries(services.map((service) => [service.id, runtime[service.id] ?? { ...EMPTY_RUNTIME }])),
    };
}
function runtimeFor(settings, id) {
    return settings.runtime[id] ?? { ...EMPTY_RUNTIME };
}
/**
 * The key face, in list order.
 *
 * A service with no URL reads as a configuration error rather than as unknown, so a half-finished
 * entry is visible on the key instead of looking like one that has simply not run yet.
 */
function boardCells(settings) {
    return settings.services.map((service) => {
        if (!service.url.trim())
            return "config-error";
        return runtimeFor(settings, service.id).currentState;
    });
}

function buildBoardOverview(settings, undo = null) {
    const services = settings.services.map((service) => {
        const runtime = runtimeFor(settings, service.id);
        // The service's own threshold, not the board's: a service that overrides it was being
        // measured against a number it does not use, so its slow count and its bars disagreed with
        // its own state.
        const slowThresholdMs = resolveService(settings.defaults, service, runtime).slowThresholdMs;
        const stats = buildStats(runtime.history ?? [], slowThresholdMs);
        const state = service.url.trim() ? runtime.currentState : "config-error";
        return {
            id: service.id,
            name: service.name || "Unnamed service",
            url: service.url,
            state,
            stateLabel: stateLabel(state),
            lastResponseTimeMs: runtime.lastResponseTimeMs,
            lastCheckedAt: runtime.lastCheckedAt,
            uptimePct: stats.uptimePct,
            checks: stats.total,
            medianMs: stats.median,
            slowChecks: stats.overThreshold,
            consecutiveFailures: runtime.consecutiveFailures,
            lastError: lastErrorOf(runtime.history ?? [], service),
            spark: (runtime.history ?? []).slice(-24).map((record) => ({
                ms: record.responseTimeMs,
                state: !record.ok ? "fail" : record.responseTimeMs > slowThresholdMs ? "slow" : "ok",
            })),
        };
    });
    return {
        boardName: settings.boardName,
        frequency: frequencyLabel(settings.defaults.checkFrequency),
        services,
        capacity: BOARD_CAPACITY,
        undo,
        defaults: settings.defaults,
        configs: settings.services,
        total: services.length,
        // Slow is not failing — it answered. Kept apart so the header can say both.
        //
        // Nor is a configuration error, which used to be counted here: nothing is wrong with the
        // endpoint, we never asked it anything. Counting it as failing put a setup mistake and a real
        // outage in the same number on a board whose whole job is telling you which you have.
        failing: services.filter((s) => s.state === "down" || s.state === "warning").length,
        misconfigured: services.filter((s) => s.state === "config-error").length,
        slow: services.filter((s) => s.state === "slow").length,
        // Counted rather than left to the header to infer. `total - failing` counted a slow service
        // as healthy as well as slow, so the three numbers summed to more than the board held. The
        // remainder here is the never-checked and the mid-check, which the header simply omits.
        healthy: services.filter((s) => s.state === "healthy").length,
        generatedAt: Date.now(),
    };
}
/**
 * The reason a service is failing, in the words the check produced.
 *
 * A card showing "Failed" says less than one showing "Expected 200 but received 503", and the
 * difference is what tells you whether to look further. A service with no URL has not failed a
 * check at all — it has never run one — so it says what is actually wrong with it.
 */
function lastErrorOf(history, service) {
    if (!service.url.trim())
        return "No URL configured";
    const last = history[history.length - 1];
    if (!last || last.ok)
        return null;
    return last.error ?? "Check failed";
}

/** Wider than the history window: the same content, plus a list rail beside it. */
const WINDOW_WIDTH = 1080;
/**
 * Four rows of cards already fit here, which is a full board at three across.
 *
 * This was briefly raised to 900 on the assumption that the fourth row would not fit. Measured on
 * a real eleven-service board instead: four rows and their gaps are about 613px, the header above
 * the grid about 72px and the footer about 30px, so roughly 715 of the 740. Raising it bought
 * nothing and left 215px of empty space under the last row. Leave it alone without measuring.
 */
const WINDOW_HEIGHT = 740;
const VERTICAL_BIAS = 0.35;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;
const POLL_MS = 2_000;
/** Serialises for a `<script>` block; `<` must be escaped or a `</script>` inside data ends it. */
function embedJson(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
}
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
/** Lucide `copy`, ISC. Two pages, one behind the other. */
const COPY_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"`
    + ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
    + `<rect x="8" y="8" width="14" height="14" rx="2"/>`
    + `<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
/** Feather `edit-2`, MIT. A pencil, drawn as one stroke so it holds up small. */
const PENCIL_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"`
    + ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
    + `<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
/** Lucide `refresh-cw`, ISC — the same mark the history window's Check now button carries. */
const REFRESH_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"`
    + ` stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
    + `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>`
    + `<path d="M21 3v5h-5"/>`
    + `<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>`
    + `<path d="M8 16H3v5"/></svg>`;
/**
 * Builds the page.
 *
 * Exported as a test seam, for the same reason the history window's is: this is one large
 * template literal, and a stray backtick in it produces a page whose script cannot parse, which
 * shows as a window that opens completely blank.
 */
function renderBoardHtml(overview, token, options = {}) {
    const winW = options.width ?? WINDOW_WIDTH;
    const winH = options.height ?? WINDOW_HEIGHT;
    const pollMs = options.pollMs ?? POLL_MS;
    return `<!doctype html>
<html lang="en" style="background:#333333">
<head>
<meta charset="utf-8" />
<meta name="color-scheme" content="dark" />
<title>${escapeHtml(overview.boardName)} — PulseDeck</title>
<script>
/* Sizes and places a browser window ahead of first paint; the native host needs none of it. */
(function () {
  var W = ${winW}, H = ${winH};
  var root = document.documentElement;
  var revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    root.classList.add('ready');
  }
  if (window.__nativeHost) { reveal(); return; }
  try {
    var chromeW = Math.max(0, window.outerWidth - window.innerWidth);
    var chromeH = Math.max(0, window.outerHeight - window.innerHeight);
    var outerW = W + chromeW, outerH = H + chromeH;
    window.resizeTo(outerW, outerH);
    window.moveTo(
      Math.round((screen.availWidth - outerW) / 2) + (screen.availLeft || 0),
      Math.round((screen.availHeight - outerH) * ${VERTICAL_BIAS}) + (screen.availTop || 0)
    );
  } catch (e) {
    reveal();
  }
  window.addEventListener('resize', function onResize() {
    window.removeEventListener('resize', onResize);
    requestAnimationFrame(reveal);
  });
  setTimeout(reveal, 250);
})();
</script>
<style>
  /* The Quick Clips picker's palette, as the history window uses. */
  :root {
    color-scheme: dark;
    --bg: #333333;
    --header: rgba(51,51,51,.92);
    --line: rgba(255,255,255,.08);
    --fg: #f4f4f6;
    --fg-dim: #8b8b93;
    --fg-faint: #62626b;
    --card: #262626;
    --card-line: #515151;
    --hover: rgba(255,255,255,.04);
    --kbd: rgba(255,255,255,.09);
    --shadow: 0 1px 2px rgba(0,0,0,.3);
    --shadow-lift: 0 6px 18px rgba(0,0,0,.45);
    --accent: #6d9eeb;

    --ok: var(--good);
    --good: #29bd50;
    /* The healthy card's edge: --good at about 45% over the window, so it reads as green without
       eight of them competing with the two that are red. */
    --good-line: #3e763e;
    /*
     * Slow, warning and down are three points on one continuum, so they are separated on two
     * axes rather than one.
     *
     * The first attempt put warning at #e07a2c, which read as a shade of the amber next to it:
     * 15 degrees of hue apart and, measured, the same lightness to within a point and a half.
     * Hue alone cannot carry yellow, orange and red — pushing them apart on the wheel only walks
     * each one into its neighbour.
     *
     * So slow moved toward a true yellow and up in lightness, warning moved toward red and down
     * in lightness. That is about 25 degrees of hue and 11 points of lightness between them, and
     * warning now sits darker than both of its neighbours, which is a cue of its own.
     */
    --slow: #f0cc35;
    --warn: #d1621b;
    --fail: #d03b3b;
  }

  * { box-sizing: border-box; }
  html, body { height: 100%; }
  html { background: var(--bg); }
  html:not(.ready) body { visibility: hidden; }
  body {
    margin: 0;
    font: 400 13px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
    background: var(--bg); color: var(--fg);
    -webkit-font-smoothing: antialiased;
    -webkit-user-select: none; user-select: none;
    display: flex; overflow: hidden;
  }

  /* ── rail ───────────────────────────────────────────────────────────── */
  .rail {
    flex: 0 0 236px; display: flex; flex-direction: column; min-height: 0;
    padding: 16px 12px 12px 16px; gap: 10px;
    /*
     * min-width:0 is what makes the basis binding.
     *
     * A flex item defaults to min-width:auto, which means "never narrower than my content" — and
     * the rows inside are nowrap, so a long service name has no minimum at all. The rail grew to
     * fit the longest name and stole the width from the pane beside it, rather than the name
     * truncating. Every ellipsis below depends on this line.
     */
    min-width: 0;
  }
  .board-name {
    font-size: 15px; font-weight: 600; letter-spacing: -.015em; margin: 0 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .board-sub { font-size: 11px; color: var(--fg-faint); margin: 2px 4px 0; }
  .list { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
  .row {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 7px 9px; border-radius: 8px; border: 0; background: transparent;
    color: var(--fg); font: inherit; font-size: 12.5px; text-align: left; cursor: pointer;
  }
  .row:hover { background: var(--hover); }
  .row.on { background: var(--kbd); }
  .row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .row .label { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .count { font-size: 11px; color: var(--fg-faint); font-variant-numeric: tabular-nums; }
  .dot {
    display: inline-block; flex: none;
    width: 9px; height: 9px; border-radius: 50%; background: var(--fg-faint);
  }
  .dot[data-state="healthy"] { background: var(--good); }
  .dot[data-state="slow"] { background: var(--slow); }
  .dot[data-state="warning"] { background: var(--warn); }
  .dot[data-state="down"] { background: var(--fail); }
  .rail-foot { display: flex; flex-direction: column; gap: 2px; }
  .row.muted { color: var(--fg-dim); }

  /* ── detail ─────────────────────────────────────────────────────────── */
  main {
    flex: 1 1 auto; min-width: 0; min-height: 0;
    display: flex; flex-direction: column; padding: 16px 18px 12px 8px; gap: 12px;
  }
  .head { display: flex; align-items: center; gap: 14px; }
  .head .titles { flex: 1 1 auto; min-width: 0; }
  h1 {
    margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.015em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .head .sub {
    font-size: 12px; color: var(--fg-dim); margin-top: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    /* Selectable so a URL can be copied out of it, as it is on the history window's own header. */
    -webkit-user-select: text; user-select: text;
  }
  button.primary {
    font: inherit; font-size: 12px; font-weight: 600; color: var(--bg);
    background: var(--accent); border: 0; border-radius: 7px;
    padding: 6px 12px; cursor: pointer; flex: 0 0 auto;
    display: inline-flex; align-items: center; gap: 6px;
  }
  button.primary:hover:not(:disabled) { filter: brightness(1.08); }
  button.primary:disabled { background: var(--card-line); color: var(--fg-faint); cursor: default; }
  button.primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  /* Secondary header controls: an icon in a square, quiet until hovered. */
  .iconbtn {
    flex: 0 0 auto; width: 28px; height: 28px; padding: 0;
    display: inline-grid; place-items: center;
    color: var(--fg-dim); background: transparent;
    border: 1px solid var(--card-line); border-radius: 7px; cursor: pointer;
  }
  /* Any display rule outranks the browser's [hidden], so hiding one needs saying explicitly. */
  .iconbtn[hidden] { display: none; }
  .iconbtn:hover:not(:disabled) { background: var(--kbd); color: var(--fg); }
  .iconbtn:disabled { opacity: .4; cursor: default; }
  .iconbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  /*
   * Their own tooltip rather than the title attribute, which the native host does not surface.
   * An icon with no label has to be able to say what it is.
   */
  .iconbtn { position: relative; }
  .iconbtn::after {
    content: attr(data-tip);
    position: absolute; top: calc(100% + 6px); right: 0; z-index: 5;
    padding: 4px 7px; border-radius: 6px;
    background: var(--bg); color: var(--fg-dim);
    border: 1px solid var(--card-line); box-shadow: var(--shadow-lift);
    font-size: 11px; white-space: nowrap;
    opacity: 0; pointer-events: none; transition: opacity .1s ease;
  }
  .iconbtn:hover::after, .iconbtn:focus-visible::after { opacity: 1; }

  button.primary:disabled svg { animation: spin .9s linear infinite; transform-origin: 50% 50%; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { button.primary:disabled svg { animation: none; } }

  .frame { flex: 1 1 auto; min-height: 0; display: flex; position: relative; }
  /*
   * The incoming frame loads underneath the outgoing one.
   *
   * A fresh document paints its own canvas white before its stylesheet applies, and no colour on
   * the iframe element can cover that — the flash is inside the frame, not behind it. So the new
   * one is laid over the old at zero opacity and only swapped in once it has loaded, which means
   * the pane is never showing a document mid-paint.
   */
  iframe.loading { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
  .grid {
    flex: 1 1 auto; min-height: 0; overflow-y: auto;
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 11px; align-content: start;
  }
  .cardbtn {
    text-align: left; font: inherit; color: var(--fg); cursor: pointer;
    background: var(--card); border: 2px solid var(--card-line); border-radius: 11px;
    box-shadow: var(--shadow); padding: 11px 13px 10px;
    display: flex; flex-direction: column; gap: 3px; min-width: 0;
    /*
     * A floor, not a fixed height, and the whole of it is spent on the gap above the footing,
     * because margin-top:auto is what absorbs the slack.
     *
     * The card's own content comes to about 134. At 148 the four rows plus their gaps overran the
     * pane by a few pixels and the grid took a scrollbar, which cost more height again. 140 keeps
     * a little air above the rule and leaves four rows about twenty pixels clear. Set here rather
     * than as grid-auto-rows so a board of five gets the same card as a board of twelve instead
     * of three enormous ones.
     */
    min-height: 140px;
  }
  .cardbtn:hover { background: var(--hover); }
  .cardbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .cardbtn .name {
    font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cardbtn .state { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--fg-dim); }
  .cardbtn .figure {
    font-size: 20px; font-weight: 600; letter-spacing: -.02em; margin-top: 1px;
  }
  .cardbtn .figure .unit { font-size: 11px; font-weight: 500; color: var(--fg-dim); margin-left: 3px; }
  /*
   * The footing sits at the bottom of the card, not under the figure.
   *
   * margin-top:auto is what spends the height rather than padding it: the state and the figure
   * stay at the top where they are read first, the three figures line up across the whole grid,
   * and the space between them is the card breathing instead of a gap left over.
   */
  .cardbtn .stats {
    margin-top: auto; padding-top: 9px; border-top: 1px solid rgba(255,255,255,.07);
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  }
  .cardbtn .stat { min-width: 0; }
  .cardbtn .stat .k {
    font-size: 9.5px; letter-spacing: .07em; text-transform: uppercase; color: var(--fg-faint);
  }
  .cardbtn .stat .v {
    font-size: 13px; font-weight: 600; color: var(--fg-dim); font-variant-numeric: tabular-nums;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cardbtn .stat .v .u { font-size: 10px; font-weight: 500; color: var(--fg-faint); margin-left: 2px; }
  /*
   * Every state carries its colour, but not at the same volume.
   *
   * Healthy was deliberately left grey while the cards still had sparklines: colouring all of
   * them made a wall of green, and the eye had to find the one that differed by hue alone. Taking
   * the sparklines out took most of the colour with them, and a view where nothing is coloured
   * asks you to read every card to learn that everything is fine.
   *
   * So healthy gets a green edge at about half the strength of the others, and only the
   * exceptions tint their face. Trouble still wins on brightness and on fill, which is two
   * channels against one.
   */
  .cardbtn[data-state="healthy"] { border-color: var(--good-line); }
  .cardbtn[data-state="slow"] { border-color: var(--slow); }
  /*
   * Warning is its own colour here, and shares red with down on the key face.
   *
   * That is not an inconsistency to tidy up later. The key collapses them because a cell is about
   * 14px and a fifth hue between amber and red is guesswork at that size, worse for anyone
   * red/green colourblind. A card is 240px wide with the word "Warning" written on it, so the
   * colour is confirming a label rather than carrying the whole message alone.
   *
   * Warning keeps the tinted face, because it is a failure: the difference from down is that it
   * has not yet failed enough times in a row to be believed. So hue separates them and fill still
   * marks both as trouble, which is what keeps the pair apart from slow.
   */
  .cardbtn[data-state="warning"] { border-color: var(--warn); background: #2f2a20; }
  .cardbtn[data-state="warning"]:hover { background: #363023; }
  /*
   * A configuration error keeps the default grey, with never-checked and mid-check.
   *
   * It was red, which made it the only state whose colour described the service rather than what
   * the checker found — nothing is wrong with the endpoint, we never asked it anything. Red also
   * put it in the same bucket as a real outage on a board where the outage is what you are
   * looking for. The key face already drew it grey, so this is the window catching up.
   */
  .cardbtn[data-state="down"] { border-color: var(--fail); background: #2f2323; }
  .cardbtn[data-state="down"]:hover { background: #352626; }
  .cardbtn svg { display: block; width: 100%; height: 26px; margin-top: 4px; }

  .empty {
    flex: 1 1 auto; display: flex; align-items: center; justify-content: center;
    color: var(--fg-faint); font-size: 12px; text-align: center; padding: 30px;
  }
  /*
   * The selected service's view is the history window's own page in a frame.
   *
   * A frame rather than a copy of its markup: the chart, the tooltip, the filter and the sort are
   * a few hundred lines that are already written and tested, and a second implementation of them
   * would drift within a week. It is same-origin, so it shares nothing but the server.
   */
  iframe {
    flex: 1 1 auto; min-height: 0; width: 100%;
    border: 0; border-radius: 11px;
    /* The element's own colour, so the gap between one document unloading and the next painting
       is the page colour rather than the browser's white canvas. */
    background: var(--bg); color-scheme: dark;
  }
  .panel {
    background: var(--card); border: 2px solid var(--card-line); border-radius: 11px;
    box-shadow: var(--shadow); padding: 13px 15px 12px;
  }
  .panel h2 { font-size: 13px; font-weight: 600; margin: 0 0 6px; }
  .panel p { margin: 0 0 4px; color: var(--fg-dim); font-size: 12px; }
  .panel .url { color: var(--fg-faint); -webkit-user-select: text; user-select: text; }

  /* ── forms ──────────────────────────────────────────────────────────── */
  .form { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-right: 4px; }
  /*
   * Three fixed columns, not a flex row.
   *
   * As flex, the hint sat after the input and took whatever width its text needed, so the input
   * ended wherever that text began: "shown on the card and in the list" made the Name box narrow
   * and "board: 1" made Amber after wide. Every input in a form was a different length, for a
   * reason that had nothing to do with what goes in it. A fixed hint column ends that.
   */
  /*
   * Two columns, not three.
   *
   * The third column existed to hold hints beside the inputs, which cost every field 196px of
   * width to carry a few words on two of them. The hints that survive sit under their input
   * instead, so a field is as wide as the form and the labels still line up.
   */
  .field {
    display: grid; grid-template-columns: 132px minmax(0, 1fr);
    align-items: center; gap: 4px 12px; margin-bottom: 11px;
  }
  .field label { font-size: 12px; color: var(--fg-dim); text-align: right; }
  .field input[type="text"], .field select {
    width: 100%; min-width: 0; font: inherit; font-size: 12.5px; color: var(--fg);
    background: var(--card); border: 1px solid var(--card-line); border-radius: 7px;
    padding: 6px 9px; outline: none;
  }
  .field input:focus, .field select:focus { border-color: var(--accent); }
  /* Under the input it describes, in the input's column — never beside it. */
  .field .hint { grid-column: 2; font-size: 11px; color: var(--fg-faint); }
  /* The checkbox row keeps the old flex, because its hint is a sentence that belongs beside the
     box rather than in the narrow column the other hints share. */
  .field.check { display: flex; align-items: center; gap: 12px; }
  .field.check label { flex: 0 0 132px; }
  .field.check input { margin: 0; }

  /*
   * Header rows: name, value and remove on one line.
   *
   * The body spans the input column and the hint column, because a token is long and the hint
   * column is dead space here. Each input needs width:auto to undo the form's width:100%, which
   * would otherwise make both of them want the whole row and stack them.
   */
  .field.headers { align-items: start; }
  .field.headers label { padding-top: 7px; }
  .headers-body { grid-column: 2; min-width: 0; }
  .header-rows { display: flex; flex-direction: column; gap: 6px; }
  .header-row { display: flex; align-items: center; gap: 6px; }
  .header-row input[type="text"] { width: auto; flex: 1 1 auto; }
  /* The name is the shorter of the two: a value holds the token. */
  .header-row input.h-name { flex: 0 0 32%; }
  .h-remove {
    flex: 0 0 auto; width: 28px; height: 28px; padding: 0;
    font: inherit; font-size: 15px; line-height: 1; color: var(--fg-faint);
    background: transparent; border: 1px solid var(--card-line); border-radius: 7px;
    cursor: pointer;
  }
  .h-remove:hover { color: var(--fail); background: var(--kbd); }
  .h-add {
    font: inherit; font-size: 11.5px; color: var(--fg-dim); background: transparent;
    border: 0; padding: 7px 0 0; cursor: pointer;
  }
  .h-add:hover { color: var(--fg); text-decoration: underline; }
  .h-note { font-size: 11px; color: var(--fg-faint); padding-top: 5px; }

  /*
   * The numbers go in a grid of their own.
   *
   * Six of them each took a full row to hold three digits, which made the overrides section as
   * tall as the rest of the form put together and left a 500px box for the value 200. Three
   * across turns six rows into two, and a fixed column means all six are the same width as each
   * other whatever their label or hint says.
   *
   * Indented to 144px so the column starts where every other input in the form starts.
   */
  /*
   * The row exists so the grid inside it lands in the input column exactly.
   *
   * Indenting by a matching 144px got the left edge right and left the right edge 20px past every
   * other input, because three fixed columns plus their gaps do not add up to a column sized by
   * what is left over. Reusing the same three-column track and placing the grid in the second one
   * makes both edges follow the form instead of being guessed at.
   */
  .numrow {
    display: grid; grid-template-columns: 132px minmax(0, 1fr);
    gap: 12px; margin-bottom: 4px;
  }
  .numgrid {
    grid-column: 2;
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 14px;
  }
  .numgrid .field { display: block; margin: 0; }
  .numgrid .field label { display: block; text-align: left; margin-bottom: 4px; }
  .numgrid .field input[type="text"] { width: 100%; }
  .numgrid .field .hint { display: block; margin-top: 4px; }
  details { margin: 14px 0 4px; }
  /* 144px, not 132: the label column plus its gap, so the disclosure starts where inputs do. */
  summary {
    cursor: pointer; font-size: 12px; color: var(--fg-dim); margin-bottom: 10px;
    padding-left: 144px;
  }
  summary:hover { color: var(--fg); }
  .form-actions {
    display: flex; align-items: center; gap: 8px; margin: 16px 0 4px;
    padding-left: 144px;
  }
  /* Delete sits away from Cancel. Adjacent, the destructive button is one slip from the one you
     press to back out, and they are the two you reach for in the same frame of mind. */
  .form-actions .danger { margin-left: auto; }
  button.ghost {
    font: inherit; font-size: 12px; color: var(--fg-dim);
    background: transparent; border: 1px solid var(--card-line); border-radius: 7px;
    padding: 6px 12px; cursor: pointer;
  }
  button.ghost:hover { background: var(--kbd); color: var(--fg); }
  button.ghost.danger:hover { color: var(--fail); }
  button.ghost:focus-visible, button.primary:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 2px;
  }
  .error { color: #ff8080; font-size: 11.5px; padding-left: 144px; min-height: 15px; }

  /* A notice, in the footer's line rather than over the content it is about. */
  .notice { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--fg-dim); }
  .notice button {
    font: inherit; font-size: 11px; color: var(--accent);
    background: transparent; border: 0; padding: 0; cursor: pointer; text-decoration: underline;
  }

  /*
   * Reordering lives on the row, because the row's order is what it changes.
   *
   * Hidden with visibility rather than display, so the controls keep their box and the row does
   * not change size as the pointer crosses it — the label would otherwise reflow and the whole
   * list would twitch as you moved down it.
   */
  .row .moves { display: flex; visibility: hidden; gap: 1px; flex: 0 0 auto; }
  .row:hover .moves, .row.on .moves { visibility: visible; }
  .row .moves span {
    width: 16px; height: 16px; border-radius: 4px; display: grid; place-items: center;
    color: var(--fg-faint); font-size: 9px;
  }
  .row .moves span:hover { background: var(--kbd); color: var(--fg); }
  .row .moves span.off { opacity: .25; pointer-events: none; }

  footer { flex: 0 0 auto; display: flex; align-items: center; gap: 16px; height: 30px; }
  footer span { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--fg-faint); }
  footer .keys { margin-left: auto; gap: 12px; }
  kbd {
    display: inline-grid; place-items: center; min-width: 17px; height: 17px; padding: 0 4px;
    background: var(--kbd); border-radius: 4px; font: inherit; font-size: 10px; color: var(--fg-dim);
  }
</style>
</head>
<body>
<nav class="rail">
  <div>
    <h2 class="board-name" id="board-name"></h2>
    <p class="board-sub" id="board-sub"></p>
  </div>
  <div class="list" id="list"></div>
  <div class="rail-foot">
    <button type="button" class="row muted" id="add"><span class="label">Add service</span></button>
    <button type="button" class="row muted" id="settings"><span class="label">Board settings</span></button>
  </div>
</nav>

<main>
  <div class="head">
    <div class="titles">
      <h1 id="title"></h1>
      <div class="sub" id="subtitle"></div>
    </div>
    <button type="button" class="iconbtn" id="duplicate" hidden
      aria-label="Duplicate service" data-tip="Duplicate">${COPY_SVG}</button>
    <button type="button" class="iconbtn" id="edit" hidden
      aria-label="Edit service" data-tip="Edit">${PENCIL_SVG}</button>
    <button type="button" class="primary" id="check">${REFRESH_SVG}<span id="check-label">Check all</span></button>
  </div>
  <div id="detail" class="grid"></div>
  <footer>
    <span id="foot"></span>
    <span class="notice" id="notice" hidden></span>
    <span class="keys"><span><kbd>esc</kbd> close</span></span>
  </footer>
</main>

<script>
(function () {
  'use strict';
  var TOKEN = ${embedJson(token)};
  var POLL_MS = ${pollMs};
  var data = ${embedJson(overview)};
  /** null means the All view; otherwise the id of the selected service. */
  var selected = null;
  /**
   * A service's settings, waiting to fill the add form. Set by Duplicate, cleared once used.
   *
   * Duplicating opens the form rather than adding a copy outright: the copy would share the
   * original's URL, so it would be checked immediately against an endpoint already covered, and
   * changing that URL is the first thing anybody does anyway.
   */
  var formSeed = null;
  /** 'list' shows the selection; the others are the forms, which sit over it. */
  var view = 'list';

  window.addEventListener('error', function (e) {
    post('error', { message: String(e.message) + ' @' + e.lineno + ':' + e.colno });
  });

  /**
   * Anything a control does, with failures shown rather than swallowed.
   *
   * A handler that throws leaves a button that visibly does nothing: the click is over, no
   * message is sent, and the only trace is a line in the plugin's log. That is exactly how a
   * broken Save looked from the outside. The message goes to the form's error line if it has one,
   * and to the log either way.
   */
  function guard(where, fn) {
    return function (e) {
      try {
        fn(e);
      } catch (err) {
        var text = 'Something went wrong: ' + (err && err.message ? err.message : String(err));
        var slot = document.querySelector('.error');
        if (slot) slot.textContent = text;
        post('error', { message: where + ': ' + (err && err.message ? err.message : String(err)) });
      }
    };
  }

  function post(type, extra) {
    var body = { type: type };
    if (extra) for (var k in extra) body[k] = extra[k];
    return fetch('/message?t=' + encodeURIComponent(TOKEN), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).catch(function () { return {}; });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function ms(value) {
    if (value === null || value === undefined) return '—';
    if (value >= 10000) return (value / 1000).toFixed(1) + ' s';
    return value + ' ms';
  }

  /** One figure in a card's footing: the label above it, matching the service view's tiles. */
  function statCell(label, value, unit) {
    var cell = el('div', 'stat');
    cell.appendChild(el('div', 'k', label));
    var v = el('div', 'v', String(value));
    if (unit && value !== '—') v.appendChild(el('span', 'u', unit));
    cell.appendChild(v);
    return cell;
  }

  /** The most recent check on the board, which is when the last round landed. */
  function newestCheck(services) {
    var newest = null;
    for (var i = 0; i < services.length; i++) {
      var at = services[i].lastCheckedAt;
      if (at && (newest === null || new Date(at).getTime() > new Date(newest).getTime())) newest = at;
    }
    return newest;
  }

  function agoOf(iso) {
    if (!iso) return 'never checked';
    var seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return seconds + 's ago';
    if (seconds < 3600) return Math.round(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.round(seconds / 3600) + 'h ago';
    return Math.round(seconds / 86400) + 'd ago';
  }

  function serviceById(id) {
    for (var i = 0; i < data.services.length; i++) {
      if (data.services[i].id === id) return data.services[i];
    }
    return null;
  }

  /* ── rail ────────────────────────────────────────────────────────────── */

  function paintRail() {
    document.getElementById('board-name').textContent = data.boardName;
    var sub = data.total === 0 ? 'no services yet'
      : data.total + (data.total === 1 ? ' service · ' : ' services · ') + data.frequency;
    document.getElementById('board-sub').textContent = sub;

    var add = document.getElementById('add');
    add.disabled = data.total >= data.capacity;
    add.querySelector('.label').textContent =
      data.total >= data.capacity ? 'Board full (' + data.capacity + ')' : 'Add service';

    var list = document.getElementById('list');
    list.textContent = '';

    var all = el('button', 'row' + (selected === null ? ' on' : ''));
    all.type = 'button';
    all.appendChild(el('span', 'label', 'All services'));
    all.appendChild(el('span', 'count', String(data.total)));
    all.addEventListener('click', function () { select(null); });
    list.appendChild(all);

    for (var i = 0; i < data.services.length; i++) {
      (function (service, index) {
        var row = el('button', 'row' + (selected === service.id ? ' on' : ''));
        row.type = 'button';
        var dot = el('i', 'dot');
        dot.setAttribute('data-state', service.state);
        row.appendChild(dot);
        var label = el('span', 'label', service.name);
        // Truncation hides text, so the whole name stays available on hover.
        label.title = service.name;
        row.appendChild(label);

        /*
         * Up and down live on the row because the row's position is what they change, and that
         * position is the cell the service occupies on the key — top-left is the first row.
         */
        var moves = el('span', 'moves');
        moves.appendChild(moveControl('\u25B2', service.id, -1, index === 0));
        moves.appendChild(moveControl('\u25BC', service.id, 1, index === data.services.length - 1));
        row.appendChild(moves);

        row.addEventListener('click', function () { select(service.id); });
        list.appendChild(row);
      })(data.services[i], i);
    }
  }

  /*
   * The header line, refreshed on its own because one part of it moves without the data moving.
   *
   * "checked 42s ago" is a clock, and apply() repaints only when the board's signature changes,
   * so between two checks a minute apart the clock sat still and then jumped a minute. Putting
   * the elapsed time into the signature instead would force a full repaint every few seconds
   * purely to retype a string, and would fight the guard that stops an open form being rebuilt.
   */
  function paintSummary() {
    document.getElementById('title').textContent = 'All services';
    var parts = [];
    if (data.total === 0) parts.push('nothing configured yet');
    else {
      // Counted, not inferred. This was total minus failing, which called a slow service healthy
      // and slow at once, so a board of eleven read "9 of 11 healthy · 1 slow · 2 failing".
      parts.push(data.healthy + ' of ' + data.total + ' healthy');
      if (data.slow) parts.push(data.slow + ' slow');
      if (data.failing) parts.push(data.failing + ' failing');
      // Said separately, or a service with no URL would be counted nowhere and show as a grey
      // card the summary never mentions.
      if (data.misconfigured) parts.push(data.misconfigured + ' not configured');
    }
    // One clock for the board, because there is one round.
    var freshest = newestCheck(data.services);
    if (freshest) parts.push('checked ' + agoOf(freshest));
    document.getElementById('subtitle').textContent = parts.join(' · ');
  }

  function moveControl(glyph, id, delta, disabled) {
    var control = el('span', disabled ? 'off' : '', glyph);
    control.setAttribute('role', 'button');
    control.title = delta < 0 ? 'Move up' : 'Move down';
    control.addEventListener('click', function (e) {
      // The row is a button and a click on the control would select it as well.
      e.stopPropagation();
      if (disabled) return;
      post('move-service', { id: id, delta: delta }).then(refresh);
    });
    return control;
  }

  /* ── sparkline ───────────────────────────────────────────────────────── */

  /**
   * One card's response times. Failures are drawn as full-height marks rather than as their
   * elapsed time, the same rule the history chart follows: a refused connection returns in
   * three milliseconds and would otherwise read as the fastest check on the card.
   */
  function sparkSvg(points) {
    if (!points.length) return '';
    var W = 160, H = 26, gap = 1.5;
    var band = W / points.length;
    var barW = Math.max(1.2, band - gap);
    var top = 0;
    for (var i = 0; i < points.length; i++) {
      if (points[i].state !== 'fail' && points[i].ms > top) top = points[i].ms;
    }
    if (top <= 0) top = 1;
    var svg = '';
    for (var j = 0; j < points.length; j++) {
      var x = j * band;
      var point = points[j];
      var failed = point.state === 'fail';
      var h = failed ? H : Math.max(1.5, (Math.min(point.ms, top) / top) * (H - 2));
      var y = H - h;
      // The same three colours the chart and the key use, so a bar means the same thing wherever
      // it appears: a slow check is amber here as well as on the card's own state line.
      var fill = failed ? 'var(--fail)' : point.state === 'slow' ? 'var(--slow)' : 'var(--ok)';
      svg += '<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + barW.toFixed(2)
        + '" height="' + h.toFixed(2) + '" rx="1" style="fill:' + fill + '" />';
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">'
      + svg + '</svg>';
  }

  /* ── detail ──────────────────────────────────────────────────────────── */

  function paintAll() {
    document.getElementById('edit').hidden = true;
    document.getElementById('duplicate').hidden = true;
    var detail = document.getElementById('detail');
    detail.className = 'grid';
    detail.textContent = '';

    paintSummary();

    if (!data.services.length) {
      var note = el('div', 'empty',
        'No services on this board yet. Add them from the key\\u2019s Property Inspector for now — '
        + 'adding them here is the next piece of work.');
      detail.className = '';
      detail.appendChild(note);
      return;
    }

    for (var i = 0; i < data.services.length; i++) {
      (function (service) {
        var card = el('button', 'cardbtn');
        card.type = 'button';
        card.title = service.name;
        card.appendChild(el('div', 'name', service.name));

        var state = el('div', 'state');
        var dot = el('i', 'dot');
        dot.setAttribute('data-state', service.state);
        state.appendChild(dot);
        /*
         * No timestamp on the card.
         *
         * It appeared only when a service was more than fifteen seconds behind the newest check,
         * which is a rule nobody can see: from the outside some cards carry a time and others do
         * not, for no reason the window ever states. And it was a relative time on a view that
         * repaints only when the data changes, so it sat frozen between checks. The board's one
         * clock is in the header, where it now ticks.
         */
        state.appendChild(el('span', null, service.stateLabel));
        card.appendChild(state);

        // Config error is not here: it has no failures to count, having never been checked, so it
        // takes the latency branch below and shows a dash like anything else with no reading.
        var failing = service.state === 'down' || service.state === 'warning';
        var figure;
        if (failing && service.consecutiveFailures > 0) {
          // A failing service's latency is the time it took to fail, which is not a number worth
          // leading with. How many checks in a row have failed is.
          figure = el('div', 'figure', String(service.consecutiveFailures));
          figure.appendChild(el('span', 'unit',
            service.consecutiveFailures === 1 ? 'failure' : 'failures in a row'));
        } else {
          figure = el('div', 'figure',
            service.lastResponseTimeMs === null ? '—' : String(service.lastResponseTimeMs));
          if (service.lastResponseTimeMs !== null) figure.appendChild(el('span', 'unit', 'ms'));
        }
        card.appendChild(figure);

        card.setAttribute('data-state', service.state);

        /*
         * The meta line says only what deviates.
         *
         * "100% up" is six identical lines on a healthy board and says nothing; below 100 it is
         * often the most interesting thing on the card, which is how a service reading Healthy at
         * 67% up gets noticed. The timestamp moved to the header, because one round means one
         * clock, and it comes back per card only when this service is out of step with the round
         * — which is a real fault worth showing, not the timer ticking.
         */
        /*
         * The footing: three figures over the same window of checks, on every card.
         *
         * Uptime is here unconditionally. Hiding it at 100% was a mistake worth recording: it
         * saved a line on the cards that needed no attention and took the figure away from the
         * ones that did, because a reader cannot tell "100%" from "not shown" without knowing the
         * rule. A column of percentages is also comparable down the grid, which a column of
         * sometimes-percentages is not.
         *
         * Median is what gives the big number meaning. 1193ms means something different against a
         * median of 240 than against a median of 1150, and the card could not say which.
         */
        var stats = el('div', 'stats');
        stats.appendChild(statCell('uptime',
          service.uptimePct === null ? '—' : service.uptimePct + '%'));
        stats.appendChild(statCell('median',
          service.medianMs === null ? '—' : service.medianMs, 'ms'));
        stats.appendChild(statCell(service.slowChecks ? 'slow' : 'checks',
          service.slowChecks ? service.slowChecks + '/' + service.checks : service.checks));
        card.appendChild(stats);

        /*
         * The reason lives on hover, not on the card.
         *
         * As a line of its own it only appeared on failing cards, so those cards grew taller than
         * the rest and the row stopped reading as a grid — the layout moved to tell you something
         * the colour had already said. The service view is where the reason belongs in full.
         */
        if (service.lastError) card.title = service.name + ' — ' + service.lastError;

        /*
         * No sparkline here. It was the heaviest ink on the view and the least readable thing on
         * it: twenty-four bars in a 239px card is a texture, and the two things you can sense
         * from it — whether there is red in it, and whether it is spiky — are already on the card
         * as the uptime percentage and the state. What it adds over those is the *shape* of a
         * failure, flapping against hard-down, and that is what the service view is for, at a size
         * where it can be read and with the table underneath it. Eleven services put 264 marks on
         * screen to say something the numbers had already said.
         */

        card.addEventListener('click', function () { select(service.id); });
        detail.appendChild(card);
      })(data.services[i]);
    }
  }

  function paintService(id) {
    var service = serviceById(id);
    if (!service) return select(null);

    var title = document.getElementById('title');
    title.textContent = service.name;
    title.title = service.name;
    // The endpoint belongs in the header, as it is on a Health Check key: the name is whatever
    // someone typed, and the URL is the thing actually being checked.
    var subtitle = document.getElementById('subtitle');
    subtitle.textContent = service.stateLabel
      + ' · ' + (service.url || 'No URL configured')
      + ' · checked ' + agoOf(service.lastCheckedAt);
    subtitle.title = service.url;
    document.getElementById('edit').hidden = false;
    // Nothing to duplicate into on a full board.
    var dup = document.getElementById('duplicate');
    dup.hidden = false;
    dup.disabled = data.total >= data.capacity;
    dup.setAttribute('data-tip', dup.disabled ? 'Board is full' : 'Duplicate');

    var detail = document.getElementById('detail');
    detail.className = 'frame';

    /*
     * Only rebuilt when the selection changes.
     *
     * The frame keeps its own state — scroll position, table filter, sort, an open tooltip — and
     * replacing it on every two-second poll would reset all of it under the cursor. It polls the
     * same server itself, so it stays current without being touched.
     */
    /*
     * Anything that is not a frame belongs to the view we are leaving — the card grid, or a form
     * — and goes now. Only frames survive this, because a frame is what the swap below is
     * comparing against; clearing them here would defeat the point of loading behind the old one.
     */
    var children = Array.prototype.slice.call(detail.children);
    for (var c = 0; c < children.length; c++) {
      if (children[c].tagName !== 'IFRAME') detail.removeChild(children[c]);
    }

    var current = detail.querySelector('iframe:not(.loading)');
    if (current && current.getAttribute('data-id') === id) return;

    /*
     * The incoming frame loads underneath the outgoing one, and they swap on load.
     *
     * A fresh document paints its own canvas before its stylesheet applies, which showed as a
     * white flash on every switch — no colour on the iframe element can cover that, because the
     * flash is inside the frame rather than behind it. Loading it at zero opacity over the top of
     * the previous one means the pane is never showing a document mid-paint.
     */
    var pending = detail.querySelector('iframe.loading');
    if (pending) detail.removeChild(pending);

    var next = document.createElement('iframe');
    next.className = 'loading';
    next.setAttribute('data-id', id);
    next.setAttribute('title', service.name);
    next.src = '/service?id=' + encodeURIComponent(id) + '&t=' + encodeURIComponent(TOKEN);

    var swapped = false;
    function swap() {
      if (swapped) return;
      swapped = true;
      next.className = '';
      if (current && current.parentNode) current.parentNode.removeChild(current);
    }
    next.addEventListener('load', swap);
    // If load never arrives, show it anyway rather than leaving the previous service on screen
    // under the new service's name.
    setTimeout(swap, 1500);
    detail.appendChild(next);
  }

  /* ── forms ───────────────────────────────────────────────────────────── */

  /*
   * What each setting does, on hover.
   *
   * These are the fields nobody can infer from a label: "Amber after" says nothing about what
   * happens below the threshold, and "Healthy after" is meaningless without knowing it counts
   * successes rather than checks. The alternative was a line of prose under every input, which is
   * six lines of text to answer a question asked once.
   */
  var TIPS = {
    expectedStatusCode: 'The HTTP status a check must return to count as a pass.',
    timeoutMs: 'How long to wait for a response before the check counts as failed.',
    slowThresholdMs: 'A check that passes but takes longer than this is Slow rather than Healthy.',
    amberAfterFailures: 'Consecutive failures before the service turns Warning. Below this, a '
      + 'failure leaves the state alone.',
    redAfterFailures: 'Consecutive failures before the service turns Down.',
    recoverAfterSuccesses: 'Consecutive successes before a failing service is believed again. '
      + '1 recovers on the first passing check.',
    expectedBodyContains: 'Text the response body must contain. Blank skips the body check.'
  };

  /**
   * A text input with every macOS text convenience turned off.
   *
   * These fields hold URLs, header names and strings to match a response body against — none of
   * which are prose. Typing "healthy" into Body contains and having it corrected to "Healthy"
   * produces a check that silently never matches, and the same goes for smart quotes in a header
   * value. Nothing here should ever be helpfully rewritten.
   */
  function plainInput() {
    var input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocomplete', 'off');
    input.spellcheck = false;
    return input;
  }

  function field(label, hint) {
    var wrap = el('div', 'field');
    wrap.appendChild(el('label', null, label));
    var input = plainInput();
    wrap.appendChild(input);
    if (hint) wrap.appendChild(el('span', 'hint', hint));
    return { wrap: wrap, input: input };
  }

  function selectField(label, options, value) {
    var wrap = el('div', 'field');
    wrap.appendChild(el('label', null, label));
    var select = document.createElement('select');
    for (var i = 0; i < options.length; i++) {
      var option = document.createElement('option');
      option.value = options[i][0];
      option.textContent = options[i][1];
      if (options[i][0] === value) option.selected = true;
      select.appendChild(option);
    }
    wrap.appendChild(select);
    return { wrap: wrap, input: select };
  }

  function checkField(label, text, checked) {
    var wrap = el('div', 'field check');
    wrap.appendChild(el('label', null, label));
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    wrap.appendChild(input);
    wrap.appendChild(el('span', 'hint', text));
    return { wrap: wrap, input: input };
  }

  /**
   * A repeatable name/value list, for request headers.
   *
   * Reading it back returns only rows that have a name, so a blank row left at the bottom is
   * simply not saved — which is what makes "add a row, then change your mind" cost nothing.
   */
  function headerField(label, headers, inheritedNote) {
    var wrap = el('div', 'field headers');
    wrap.appendChild(el('label', null, label));

    var body = el('div', 'headers-body');
    var rows = el('div', 'header-rows');
    body.appendChild(rows);

    function addRow(name, value) {
      var row = el('div', 'header-row');
      var nameInput = plainInput();
      nameInput.placeholder = 'Name';
      nameInput.className = 'h-name';
      nameInput.value = name || '';
      var valueInput = plainInput();
      valueInput.placeholder = 'Value';
      valueInput.value = value || '';
      var remove = el('button', 'h-remove', '\\u00d7');
      remove.type = 'button';
      remove.title = 'Remove this header';
      remove.addEventListener('click', function () { rows.removeChild(row); });
      row.appendChild(nameInput);
      row.appendChild(valueInput);
      row.appendChild(remove);
      rows.appendChild(row);
      return row;
    }

    (headers || []).forEach(function (header) { addRow(header.name, header.value); });

    var add = el('button', 'h-add', 'Add header');
    add.type = 'button';
    add.addEventListener('click', function () {
      var row = addRow('', '');
      row.querySelector('input').focus();
    });
    body.appendChild(add);
    if (inheritedNote) body.appendChild(el('div', 'h-note', inheritedNote));
    wrap.appendChild(body);

    return {
      wrap: wrap,
      read: function () {
        var out = [];
        var all = rows.querySelectorAll('.header-row');
        for (var i = 0; i < all.length; i++) {
          var inputs = all[i].querySelectorAll('input');
          var name = inputs[0].value.trim();
          if (!name) continue;
          out.push({ name: name, value: inputs[1].value.trim() });
        }
        return out;
      },
      touched: function () { return rows.querySelectorAll('.header-row').length > 0; }
    };
  }

  /** Blank means inherit, so an override reads as a number or as nothing at all. */
  function overrideValue(raw) {
    var text = String(raw === null || raw === undefined ? '' : raw).trim();
    if (text === '') return null;
    var value = Number(text);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function configById(id) {
    for (var i = 0; i < data.configs.length; i++) {
      if (data.configs[i].id === id) return data.configs[i];
    }
    return null;
  }

  /**
   * The add and edit form.
   *
   * Overrides are collapsed behind a disclosure and show the board's value as a placeholder, so
   * an empty field reads as "whatever the board says" rather than as unset. That is the whole
   * point of shared defaults: a board should not carry twelve copies of the same timeout.
   */
  function paintForm(id) {
    var editing = !!id;
    var config = editing ? configById(id) : (formSeed || null);
    if (editing && !config) return select(null);
    // Used once: coming back to a blank Add form afterwards must not resurrect it.
    formSeed = null;

    var copying = !editing && !!config;
    document.getElementById('title').textContent = editing ? 'Edit service'
      : copying ? 'Duplicate service' : 'Add service';
    document.getElementById('subtitle').textContent = editing
      ? 'Changes take effect on the next check, which runs as soon as you save.'
      : copying
        ? 'Everything is copied. Change what you need, then add it.'
        : 'It is checked as soon as you add it.';
    document.getElementById('check').hidden = true;

    var detail = document.getElementById('detail');
    detail.className = 'form';
    detail.textContent = '';

    var name = field('Name');
    name.input.value = config ? config.name : '';
    name.input.placeholder = 'Optional — defaults to the host';
    var url = field('URL');
    url.input.value = config ? config.url : '';
    url.input.placeholder = 'https://api.example.com/health';
    detail.appendChild(name.wrap);
    detail.appendChild(url.wrap);

    var advanced = document.createElement('details');
    advanced.open = !!(config && hasOverrides(config));
    advanced.appendChild(el('summary', null, 'Overrides for this service'));

    var d = data.defaults;
    var status = field('Expected status');
    var timeout = field('Timeout (ms)');
    var slow = field('Slow over (ms)');
    var amber = field('Amber after');
    var red = field('Red after');
    var recover = field('Healthy after');
    var body = field('Body contains');
    var fields = [status, timeout, slow, amber, red, recover, body];
    var keys = ['expectedStatusCode', 'timeoutMs', 'slowThresholdMs', 'amberAfterFailures',
                'redAfterFailures', 'recoverAfterSuccesses', 'expectedBodyContains'];
    for (var f = 0; f < fields.length; f++) {
      var key = keys[f];
      var stored = config ? config[key] : null;
      fields[f].input.value = stored === null || stored === undefined ? '' : String(stored);
      /*
       * The board's value *is* the placeholder, rather than the word "inherit" with the value
       * spelled out beside it.
       *
       * It puts the number where the number goes, and greyed against typed is already the
       * difference between inheriting and overriding, so the row needs no second line to say
       * which it is. That retired six hint lines from this form.
       */
      var inherited = d[key];
      fields[f].input.placeholder =
        inherited === '' || inherited === null || inherited === undefined
          ? 'not checked' : String(inherited);
      // No escape sequences in here, not even in this comment. Everything in this file is inside
      // a template literal, so an escaped newline becomes a real one: in a string it breaks the
      // quote across two lines, and in a comment it ends the comment and leaves the rest of the
      // sentence as code. The second one still parses, so the page test does not catch it.
      fields[f].wrap.title = TIPS[key]
        + '  Board default: ' + fields[f].input.placeholder + '. Leave blank to inherit it.';
    }
    var numrow = el('div', 'numrow');
    var numbers = el('div', 'numgrid');
    var numeric = [status, timeout, slow, amber, red, recover];
    for (var g = 0; g < numeric.length; g++) numbers.appendChild(numeric[g].wrap);
    numrow.appendChild(numbers);
    advanced.appendChild(numrow);
    advanced.appendChild(body.wrap);
    var snippet = checkField('Body snippet', 'store the response body in this service\u2019s history',
      config && config.showBodySnippetInHistory !== null
        ? config.showBodySnippetInHistory : d.showBodySnippetInHistory);
    advanced.appendChild(snippet.wrap);

    // Overriding headers replaces the board's rather than adding to them, so the note says what
    // the board sends and leaving the list empty inherits it.
    var inherited = d.headers.length
      ? 'Empty inherits the board\u2019s ' + d.headers.length
        + (d.headers.length === 1 ? ' header' : ' headers')
      : 'The board sends none';
    var headers = headerField('Headers',
      config && config.headers ? config.headers : [], inherited);
    advanced.appendChild(headers.wrap);
    detail.appendChild(advanced);

    var error = el('div', 'error');
    var actions = el('div', 'form-actions');
    var save = el('button', 'primary', editing ? 'Save changes' : 'Add service');
    save.type = 'button';
    var cancel = el('button', 'ghost', 'Cancel');
    cancel.type = 'button';
    actions.appendChild(save);
    actions.appendChild(cancel);
    if (editing) {
      var remove = el('button', 'ghost danger', 'Delete');
      remove.type = 'button';
      remove.addEventListener('click', function () {
        post('delete-service', { id: id }).then(function () {
          select(null);
          refresh();
        });
      });
      actions.appendChild(remove);
    }
    detail.appendChild(actions);
    detail.appendChild(error);

    cancel.addEventListener('click', function () { select(editing ? id : null); });

    save.addEventListener('click', guard('save service', function () {
      var value = url.input.value.trim();
      if (!value) return fail('A URL is required.');
      // Deliberately string comparison rather than a regex: this page is a template literal, and
      // the backslashes in /^https?:\\/\\// are consumed by it — the pattern reached the browser
      // as /^https?:\/\// with its slashes unescaped, which is a different, broken expression.
      var lower = value.toLowerCase();
      if (lower.indexOf('http://') !== 0 && lower.indexOf('https://') !== 0) {
        return fail('The URL must start with http:// or https://.');
      }

      var draft = {
        name: name.input.value.trim(),
        url: value,
        expectedStatusCode: overrideValue(status.input.value),
        timeoutMs: overrideValue(timeout.input.value),
        slowThresholdMs: overrideValue(slow.input.value),
        amberAfterFailures: overrideValue(amber.input.value),
        redAfterFailures: overrideValue(red.input.value),
        recoverAfterSuccesses: overrideValue(recover.input.value),
        expectedBodyContains: body.input.value.trim() === '' ? null : body.input.value,
        showBodySnippetInHistory: snippet.input.checked,
        // No rows means inherit; rows mean this service's own set.
        headers: headers.read().length ? headers.read() : null
      };

      save.disabled = true;
      post(editing ? 'update-service' : 'add-service', { id: id, draft: draft })
        .then(function (reply) {
          save.disabled = false;
          if (reply.message) return fail(reply.message);
          apply(reply.data);
          select(editing ? id : (reply.id || null));
        });

      function fail(message) {
        error.textContent = message;
        return false;
      }
    }));

    function fail(message) {
      error.textContent = message;
      return false;
    }
  }

  function hasOverrides(config) {
    var keys = ['expectedStatusCode', 'timeoutMs', 'slowThresholdMs', 'amberAfterFailures',
                'redAfterFailures', 'recoverAfterSuccesses', 'expectedBodyContains',
                'showBodySnippetInHistory'];
    for (var i = 0; i < keys.length; i++) {
      if (config[keys[i]] !== null && config[keys[i]] !== undefined) return true;
    }
    return false;
  }

  /** The board's own settings: its name, its clock, and what every service inherits. */
  function paintSettings() {
    document.getElementById('title').textContent = 'Board settings';
    document.getElementById('subtitle').textContent =
      'Every service uses these unless it overrides them.';
    document.getElementById('check').hidden = true;

    var detail = document.getElementById('detail');
    detail.className = 'form';
    detail.textContent = '';

    var d = data.defaults;
    var name = field('Board name');
    name.input.value = data.boardName;
    var frequency = selectField('Check every', [
      ['manual', 'Manual only'], ['1m', 'Minute'], ['5m', '5 minutes'],
      ['10m', '10 minutes'], ['30m', '30 minutes'], ['1h', 'Hour']
    ], d.checkFrequency);
    var status = field('Expected status');
    status.input.value = String(d.expectedStatusCode);
    var timeout = field('Timeout (ms)');
    timeout.input.value = String(d.timeoutMs);
    var slow = field('Slow over (ms)');
    slow.input.value = String(d.slowThresholdMs);
    var amber = field('Amber after', 'failures');
    amber.input.value = String(d.amberAfterFailures);
    var red = field('Red after', 'failures');
    red.input.value = String(d.redAfterFailures);
    var recover = field('Healthy after', 'successes');
    recover.input.value = String(d.recoverAfterSuccesses);
    var body = field('Body contains', 'blank to skip the body');
    body.input.value = d.expectedBodyContains;
    var snippet = checkField('Body snippet', 'store response bodies in history',
      d.showBodySnippetInHistory);

    detail.appendChild(name.wrap);
    detail.appendChild(frequency.wrap);
    var numrow = el('div', 'numrow');
    var numbers = el('div', 'numgrid');
    var numeric = [status, timeout, slow, amber, red, recover];
    var numKeys = ['expectedStatusCode', 'timeoutMs', 'slowThresholdMs', 'amberAfterFailures',
                   'redAfterFailures', 'recoverAfterSuccesses'];
    for (var i = 0; i < numeric.length; i++) {
      numeric[i].wrap.title = TIPS[numKeys[i]];
      numbers.appendChild(numeric[i].wrap);
    }
    numrow.appendChild(numbers);
    detail.appendChild(numrow);
    body.wrap.title = TIPS.expectedBodyContains;
    detail.appendChild(body.wrap);
    detail.appendChild(snippet.wrap);

    var headers = headerField('Headers', d.headers,
      'Sent with every service unless it sets its own');
    detail.appendChild(headers.wrap);

    var error = el('div', 'error');
    var actions = el('div', 'form-actions');
    var save = el('button', 'primary', 'Save settings');
    save.type = 'button';
    var cancel = el('button', 'ghost', 'Cancel');
    cancel.type = 'button';
    actions.appendChild(save);
    actions.appendChild(cancel);
    detail.appendChild(actions);
    detail.appendChild(error);

    cancel.addEventListener('click', function () { select(null); });
    save.addEventListener('click', guard('save board settings', function () {
      var update = {
        boardName: name.input.value.trim(),
        defaults: {
          checkFrequency: frequency.input.value,
          expectedStatusCode: overrideValue(status.input.value) || d.expectedStatusCode,
          timeoutMs: overrideValue(timeout.input.value) || d.timeoutMs,
          slowThresholdMs: overrideValue(slow.input.value) || d.slowThresholdMs,
          amberAfterFailures: overrideValue(amber.input.value) || d.amberAfterFailures,
          redAfterFailures: overrideValue(red.input.value) || d.redAfterFailures,
          recoverAfterSuccesses:
            overrideValue(recover.input.value) || d.recoverAfterSuccesses,
          expectedBodyContains: body.input.value,
          showBodySnippetInHistory: snippet.input.checked,
          headers: headers.read()
        }
      };
      if (update.defaults.redAfterFailures < update.defaults.amberAfterFailures) {
        error.textContent = 'Red must be at least as many failures as amber.';
        return;
      }
      if (update.defaults.recoverAfterSuccesses < 1) {
        error.textContent = 'Healthy after must be at least one success.';
        return;
      }
      save.disabled = true;
      post('update-board', { update: update }).then(function (reply) {
        save.disabled = false;
        if (reply.message) { error.textContent = reply.message; return; }
        apply(reply.data);
        select(null);
      });
    }));
  }

  function paintDetail() {
    var check = document.getElementById('check');
    check.hidden = false;
    if (view === 'add' || view === 'edit') paintForm(view === 'edit' ? selected : null);
    else if (view === 'settings') paintSettings();
    else if (selected === null) paintAll();
    else paintService(selected);
  }

  function paint() {
    paintRail();
    paintNotice();
    document.getElementById('edit').hidden = true;
    document.getElementById('duplicate').hidden = true;
    paintDetail();
    // One button, two jobs: it checks whatever is on screen, which is the whole board on All and
    // one service otherwise.
    document.getElementById('check-label').textContent =
      checking ? 'Checking…' : (selected === null ? 'Check all' : 'Check now');
    document.getElementById('check').disabled = checking || data.total === 0;
    document.getElementById('foot').textContent =
      data.total ? 'Checks run ' + data.frequency : '';
  }

  function select(id) {
    selected = id;
    view = 'list';
    paint();
  }

  function show(next) {
    view = next;
    paint();
  }

  /** Re-reads the board and repaints; used after a mutation, which never returns the overview. */
  function refresh() {
    return post('poll').then(function (reply) {
      if (reply.data) { data = reply.data; lastSignature = signature(data); paint(); }
    });
  }

  function paintNotice() {
    var notice = document.getElementById('notice');
    notice.textContent = '';
    if (!data.undo) { notice.hidden = true; return; }
    notice.hidden = false;
    notice.appendChild(el('span', null, 'Deleted ' + data.undo + '.'));
    var undo = el('button', null, 'Undo');
    undo.type = 'button';
    undo.addEventListener('click', function () {
      post('undo-delete').then(function (reply) {
        if (reply.message) return;
        if (reply.data) { data = reply.data; lastSignature = signature(data); }
        selected = reply.id || null;
        view = 'list';
        paint();
      });
    });
    notice.appendChild(undo);
    notice.hidden = false;
  }

  /* ── refresh ─────────────────────────────────────────────────────────── */

  function signature(d) {
    var parts = [d.boardName, d.total, d.failing, d.slow, d.frequency, d.undo,
                 JSON.stringify(d.defaults)];
    for (var i = 0; i < d.services.length; i++) {
      var s = d.services[i];
      parts.push(s.id, s.name, s.state, s.lastCheckedAt, s.checks);
      parts.push(JSON.stringify(d.configs[i] || null));
    }
    return parts.join('|');
  }
  var lastSignature = signature(data);

  function apply(next) {
    if (!next) return;
    var changed = signature(next) !== lastSignature;
    data = next;
    lastSignature = signature(next);
    // Ahead of the early return: the clock in the header is the one thing that moves while the
    // board stands still.
    if (view === 'list' && selected === null) paintSummary();
    if (!changed) return;
    /*
     * A form owns the pane for as long as it is open.
     *
     * The board keeps polling underneath it — a check landing every few seconds changes the
     * data, and repainting on that would rebuild the form and throw away whatever has been
     * typed into it. The rail and the notice still update, so the window stays live around the
     * edges.
     */
    if (view !== 'list') {
      paintRail();
      paintNotice();
      return;
    }
    paint();
  }

  var checking = false;
  function runCheck() {
    if (checking || data.total === 0) return;
    checking = true;
    var button = document.getElementById('check');
    var label = document.getElementById('check-label');
    button.disabled = true;
    label.textContent = 'Checking…';
    var request = selected === null
      ? post('check-all')
      : post('check-service', { id: selected });
    request.then(function (reply) {
      apply(reply.data);
    }).then(function () {
      checking = false;
      button.disabled = false;
      label.textContent = selected === null ? 'Check all' : 'Check now';
    });
  }

  document.getElementById('check').addEventListener('click', runCheck);
  document.getElementById('edit').addEventListener('click', function () { show('edit'); });
  document.getElementById('duplicate').addEventListener('click', function () {
    var config = configById(selected);
    if (!config || data.total >= data.capacity) return;
    formSeed = JSON.parse(JSON.stringify(config));
    formSeed.name = config.name + ' copy';
    show('add');
  });
  document.getElementById('add').addEventListener('click', function () {
    if (data.total >= data.capacity) return;
    show('add');
  });
  document.getElementById('settings').addEventListener('click', function () { show('settings'); });

  /** Whether the keystroke belongs to a field the user is typing in. */
  function isTyping(e) {
    var target = e.target;
    if (!target) return false;
    var tag = (target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'select' || tag === 'textarea' || target.isContentEditable;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      // In a form, Escape cancels the form rather than the window: closing the whole board
      // because someone backed out of an edit is not what that key means here.
      if (view !== 'list') { select(selected); return; }
      post('close');
      window.close();
      return;
    }
    /*
     * Bare-letter shortcuts stop at the edge of a text field.
     *
     * Without this, typing a name containing "r" ran a round of checks — and the data that came
     * back repainted the pane, rebuilding the form and discarding what had been typed. Any
     * unmodified letter bound as a shortcut has this failure mode the moment a page grows a
     * field.
     */
    if (isTyping(e)) return;
    if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) runCheck();
  });

  setInterval(function () {
    if (checking) return;
    post('poll').then(function (reply) { apply(reply.data); });
  }, POLL_MS);

  var lastPing = 0;
  function touch() {
    var now = Date.now();
    if (now - lastPing < 5000) return;
    lastPing = now;
    post('ping');
  }
  document.addEventListener('keydown', touch, true);
  document.addEventListener('pointerdown', touch, true);
  document.addEventListener('wheel', touch, true);

  window.addEventListener('beforeunload', function () { post('close'); });

  paint();
})();
</script>
</body>
</html>`;
}
/** Shows the board window and resolves when it closes. */
async function showBoardWindow(hostPath, options) {
    return serveWindow(hostPath, {
        width: options.width ?? WINDOW_WIDTH,
        height: options.height ?? WINDOW_HEIGHT,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        onWarn: options.onWarn,
        onOpen: options.onOpen,
        renderPage: (token) => renderBoardHtml(options.getOverview(), token, {
            width: options.width ?? WINDOW_WIDTH,
            height: options.height ?? WINDOW_HEIGHT,
        }),
        /**
         * The frame's page. Answered only for a service the board actually holds — the same rule the
         * picker follows for icons, so the page cannot ask for something it is not showing.
         */
        renderRoute: (pathname, params) => {
            if (pathname !== "/service")
                return null;
            const id = params.get("id");
            if (!id || !options.getServicePage)
                return null;
            return options.getServicePage(id, params.get("t") ?? "");
        },
        onMessage: async (message) => {
            if (message.type === "poll") {
                // A scoped poll comes from the embedded service view, not from the board itself.
                if (typeof message.scope === "string") {
                    const snapshot = options.getServiceSnapshot?.(message.scope);
                    return snapshot ? { data: snapshot } : {};
                }
                return { data: options.getOverview() };
            }
            if (message.type === "check-all") {
                await runSafely(options.onCheckAll?.(), options.onWarn, "board check");
                return { data: options.getOverview() };
            }
            if (message.type === "check-service" && typeof message.id === "string") {
                await runSafely(options.onCheckService?.(message.id), options.onWarn, "service check");
                return { data: options.getOverview() };
            }
            /*
             * Mutations report a failure rather than throwing it away: the message goes back to the
             * form, which keeps what was typed. Only a genuinely unknown message falls through.
             */
            if (message.type === "add-service" && options.onAddService) {
                const id = await options.onAddService(message.draft);
                return { data: options.getOverview(), id };
            }
            if (message.type === "update-service"
                && typeof message.id === "string" && options.onUpdateService) {
                await options.onUpdateService(message.id, message.draft);
                return { data: options.getOverview() };
            }
            if (message.type === "delete-service"
                && typeof message.id === "string" && options.onDeleteService) {
                await options.onDeleteService(message.id);
                return { data: options.getOverview() };
            }
            if (message.type === "undo-delete" && options.onUndoDelete) {
                const id = await options.onUndoDelete();
                return { data: options.getOverview(), id };
            }
            if (message.type === "move-service"
                && typeof message.id === "string" && typeof message.delta === "number"
                && options.onMoveService) {
                await options.onMoveService(message.id, message.delta);
                return { data: options.getOverview() };
            }
            if (message.type === "update-board" && options.onUpdateBoard) {
                await options.onUpdateBoard(message.update);
                return { data: options.getOverview() };
            }
            return {};
        },
    });
}
/** A failed check leaves the window up: the state it reports is already visible on the board. */
async function runSafely(work, warn, label) {
    if (!work)
        return;
    try {
        await work;
    }
    catch (error) {
        warn?.(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Health Board — up to twelve services on one key.
 *
 * Shares every piece of checking logic with the single-endpoint action: a service is flattened
 * onto the board's defaults into exactly the settings shape `runHealthCheck` and
 * `evaluateButtonState` already take. What is new here is the round — a whole board on one timer
 * — and the key face, which is generated rather than picked off disk.
 */
const LONG_PRESS_MS = 500;
const INITIAL_CHECK_DELAY_MS = 1500;
/**
 * Gap between services within a round.
 *
 * A board's worth of simultaneous requests is not a load problem, but it is a spike in whatever
 * the endpoints report, and it makes a round indivisible: staggering means the key fills in cell
 * by cell, so a slow service is visible as a cell that has not turned yet rather than as a frozen
 * key.
 *
 * At the cap this spreads a round over roughly five seconds before any response time is counted,
 * so it is the figure to revisit if the shortest check frequency ever comes down.
 */
const STAGGER_MS = 300;
let HealthBoardAction = (() => {
    let _classDecorators = [action({ UUID: "com.glenmorgan.pulsedeck.healthboard" })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = SingletonAction;
    (class extends _classSuper {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        instances = new Map();
        // ── Lifecycle ────────────────────────────────────────────────────────────
        async onWillAppear(ev) {
            if (!ev.action.isKey())
                return;
            const keyAction = ev.action;
            const instance = {
                settings: mergeBoardSettings(ev.payload.settings),
                keyDownAt: null,
                timer: null,
                inFlight: new Set(),
                roundRunning: false,
                saveTimer: null,
                dueTimer: null,
                windowOpen: false,
                closeWindow: null,
                lastDeleted: null,
            };
            this.instances.set(keyAction.id, instance);
            await this.drawKey(keyAction, instance);
            this.resetTimer(keyAction.id, keyAction);
        }
        async onWillDisappear(ev) {
            const instance = this.instances.get(ev.action.id);
            if (!instance)
                return;
            clearTimer(instance.timer);
            if (instance.saveTimer)
                clearTimeout(instance.saveTimer);
            if (instance.dueTimer)
                clearTimeout(instance.dueTimer);
            // A window outlives its key otherwise, polling a board that has stopped moving.
            instance.closeWindow?.();
            this.instances.delete(ev.action.id);
        }
        async onDidReceiveSettings(ev) {
            if (!ev.action.isKey())
                return;
            const instance = this.instances.get(ev.action.id);
            if (!instance)
                return;
            // A round in flight owns the runtime it is about to write; taking settings from underneath it
            // would lose the results of checks that have already run.
            if (instance.roundRunning)
                return;
            instance.settings = mergeBoardSettings(ev.payload.settings);
            this.resetTimer(ev.action.id, ev.action);
            await this.drawKey(ev.action, instance);
        }
        // ── Key press ────────────────────────────────────────────────────────────
        onKeyDown(ev) {
            const instance = this.instances.get(ev.action.id);
            if (instance)
                instance.keyDownAt = Date.now();
        }
        async onKeyUp(ev) {
            if (!ev.action.isKey())
                return;
            const instance = this.instances.get(ev.action.id);
            if (!instance)
                return;
            const held = instance.keyDownAt !== null ? Date.now() - instance.keyDownAt : 0;
            instance.keyDownAt = null;
            /*
             * Short press opens the board; holding checks it. The opposite way round to the
             * single-endpoint key, deliberately.
             *
             * A board key is a dashboard: looking at it is the common act, and a round of checks is the
             * rare, deliberate one. It is also the cheaper thing to do by accident — a stray tap opens a
             * window you can close, where the other way round it fires a request per service at
             * somebody else's endpoints. The single Health Check key keeps press-to-check, where a press
             * is one request and checking is the whole point of the key.
             */
            if (held >= LONG_PRESS_MS && instance.settings.services.length > 0) {
                await this.runRound(ev.action.id, ev.action);
                return;
            }
            // Not awaited: the window stays open until it is closed, and awaiting it here would hold the
            // key's event handler for as long as someone is reading it.
            void this.openManager(ev.action.id, ev.action);
        }
        /**
         * Opens the manager window, working down the available hosts.
         *
         * A host can be present yet fail to launch, so a failure tries the next one rather than being
         * mistaken for the user closing the window. Unlike the history window there is no osascript
         * fallback: a dialog cannot manage a list, and pretending otherwise would be worse than saying
         * plainly that no window host is available.
         */
        async openManager(id, keyAction) {
            const instance = this.instances.get(id);
            if (!instance)
                return;
            if (instance.windowOpen)
                return;
            instance.windowOpen = true;
            try {
                for (const host of await findHosts()) {
                    try {
                        await showBoardWindow(host, {
                            getOverview: () => buildBoardOverview(instance.settings, instance.lastDeleted?.service.name ?? null),
                            onCheckAll: () => this.runRound(id, keyAction),
                            onCheckService: async (serviceId) => {
                                await this.checkService(keyAction, instance, serviceId);
                                await this.persist(keyAction, instance);
                            },
                            // The selected service's pane is the history window's own page, embedded. Both
                            // windows render the same view from the same snapshot rather than each having one.
                            getServicePage: (serviceId, token) => {
                                const snapshot = this.snapshotFor(instance, serviceId);
                                if (!snapshot)
                                    return null;
                                return renderHistoryHtml(snapshot, token, {
                                    canCheck: false,
                                    embedded: true,
                                    scope: serviceId,
                                });
                            },
                            getServiceSnapshot: (serviceId) => this.snapshotFor(instance, serviceId),
                            onAddService: async (draft) => {
                                if (instance.settings.services.length >= BOARD_CAPACITY) {
                                    throw new Error(`A board holds ${BOARD_CAPACITY} services.`);
                                }
                                const url = String(draft.url ?? "");
                                const service = {
                                    ...newService("", url),
                                    ...draft,
                                    // The form's placeholder promises the host as a default, and nothing was keeping
                                    // that promise once the inspector's own add path went away: a service saved with
                                    // no name arrived as "Unnamed service" on the card and in the list.
                                    name: String(draft.name ?? "").trim() || hostOf(url),
                                    id: newServiceId(),
                                };
                                instance.settings.services.push(service);
                                instance.settings.runtime[service.id] = { ...EMPTY_RUNTIME };
                                await this.afterMutation(keyAction, instance);
                                // Checked straight away rather than waiting for the next round: adding a service is
                                // exactly when you want to know whether the URL was right.
                                void this.checkService(keyAction, instance, service.id)
                                    .then(() => this.persist(keyAction, instance));
                                return service.id;
                            },
                            onUpdateService: async (serviceId, draft) => {
                                const index = instance.settings.services.findIndex((s) => s.id === serviceId);
                                if (index < 0)
                                    throw new Error("That service is no longer on this board.");
                                const existing = instance.settings.services[index];
                                instance.settings.services[index] = {
                                    ...existing,
                                    ...draft,
                                    // Clearing the name falls back to the host, as it does when adding, rather than
                                    // leaving a service with no name at all.
                                    name: String(draft.name ?? "").trim() || hostOf(String(draft.url ?? existing.url)),
                                    id: existing.id,
                                };
                                await this.afterMutation(keyAction, instance);
                                void this.checkService(keyAction, instance, serviceId)
                                    .then(() => this.persist(keyAction, instance));
                            },
                            onDeleteService: async (serviceId) => {
                                const index = instance.settings.services.findIndex((s) => s.id === serviceId);
                                if (index < 0)
                                    return;
                                const [service] = instance.settings.services.splice(index, 1);
                                const runtime = runtimeFor(instance.settings, serviceId);
                                delete instance.settings.runtime[serviceId];
                                instance.lastDeleted = { index, service, runtime };
                                await this.afterMutation(keyAction, instance);
                            },
                            onUndoDelete: async () => {
                                const held = instance.lastDeleted;
                                if (!held)
                                    throw new Error("There is nothing to undo.");
                                if (instance.settings.services.length >= BOARD_CAPACITY) {
                                    throw new Error("The board is full; remove a service before restoring one.");
                                }
                                // Back where it was, so the grid position it had is the position it gets.
                                instance.settings.services.splice(held.index, 0, held.service);
                                instance.settings.runtime[held.service.id] = held.runtime;
                                instance.lastDeleted = null;
                                await this.afterMutation(keyAction, instance);
                                return held.service.id;
                            },
                            onMoveService: async (serviceId, delta) => {
                                const services = instance.settings.services;
                                const from = services.findIndex((s) => s.id === serviceId);
                                const to = from + delta;
                                if (from < 0 || to < 0 || to >= services.length)
                                    return;
                                const [moved] = services.splice(from, 1);
                                services.splice(to, 0, moved);
                                await this.afterMutation(keyAction, instance);
                            },
                            onUpdateBoard: async (update) => {
                                const frequencyChanged = update.defaults?.checkFrequency !== undefined
                                    && update.defaults.checkFrequency !== instance.settings.defaults.checkFrequency;
                                if (typeof update.boardName === "string") {
                                    instance.settings.boardName = update.boardName.trim() || "Health board";
                                }
                                if (update.defaults) {
                                    instance.settings.defaults = { ...instance.settings.defaults, ...update.defaults };
                                }
                                await this.afterMutation(keyAction, instance);
                                // The round's clock is the board's, so a changed frequency has to restart it.
                                if (frequencyChanged)
                                    this.resetTimer(id, keyAction);
                            },
                            onOpen: (close) => { instance.closeWindow = close; },
                            onWarn: (message) => streamDeck.logger.warn(message),
                        });
                        return;
                    }
                    catch (error) {
                        streamDeck.logger.warn("Board window host unavailable, trying the next one:", error);
                    }
                }
                streamDeck.logger.error("No window host available: the board cannot be managed without one. Build the native "
                    + "host with npm run build:native, or install a Chromium-family browser.");
            }
            finally {
                instance.windowOpen = false;
                instance.closeWindow = null;
            }
        }
        /**
         * What every mutation owes: a redrawn key and a write.
         *
         * The key is the only thing most people look at, so it must not lag a change made in the
         * window, and the write is debounced so a burst of edits costs one save rather than five.
         */
        async afterMutation(keyAction, instance) {
            await this.drawKey(keyAction, instance);
            await this.persist(keyAction, instance);
        }
        /** One service as the single-endpoint modules see it, or null if the board has no such id. */
        snapshotFor(instance, serviceId) {
            const service = instance.settings.services.find((s) => s.id === serviceId);
            if (!service)
                return null;
            return buildSnapshot(resolveService(instance.settings.defaults, service, runtimeFor(instance.settings, serviceId)));
        }
        // ── Inspector messages ───────────────────────────────────────────────────
        /**
         * The inspector holds one button, and this is what it does.
         *
         * It briefly held fields for adding a service, from before the window could. Two places to add
         * one service is one too many — they would have disagreed the first time either changed — so
         * those went with the window's own Add service.
         */
        async onSendToPlugin(ev) {
            if (!ev.action.isKey())
                return;
            const payload = ev.payload;
            if (payload.event === "openManager") {
                void this.openManager(ev.action.id, ev.action);
            }
        }
        // ── Checking ─────────────────────────────────────────────────────────────
        /**
         * One pass over every service, staggered.
         *
         * The key is redrawn as each result lands rather than once at the end, so a round is visible as
         * it happens. Settings are written once, after the whole round: nine services measured 60–80KB
         * of settings, so a full board is more than twice that, and persisting per check would rewrite
         * all of it once per service.
         */
        async runRound(id, keyAction) {
            const instance = this.instances.get(id);
            if (!instance || instance.roundRunning)
                return;
            if (instance.settings.services.length === 0)
                return;
            instance.roundRunning = true;
            try {
                const ids = instance.settings.services.map((service) => service.id);
                for (let i = 0; i < ids.length; i++) {
                    if (i > 0)
                        await delay(STAGGER_MS);
                    // Not awaited: a slow service must not hold up the rest of the round, and each result
                    // redraws the key as it arrives.
                    void this.checkService(keyAction, instance, ids[i]);
                }
                // Let the last request finish before persisting, so the round is written whole.
                await this.settle(instance);
                await this.persist(keyAction, instance);
            }
            finally {
                instance.roundRunning = false;
            }
        }
        async checkService(keyAction, instance, serviceId) {
            const service = instance.settings.services.find((s) => s.id === serviceId);
            if (!service)
                return;
            // A service still answering from the last round is skipped rather than queued: two checks of
            // the same endpoint in flight would write two records for one interval.
            if (instance.inFlight.has(serviceId))
                return;
            const runtime = runtimeFor(instance.settings, serviceId);
            const resolved = resolveService(instance.settings.defaults, service, runtime);
            if (validateSettings(resolved)) {
                runtime.currentState = "config-error";
                instance.settings.runtime[serviceId] = runtime;
                await this.drawKey(keyAction, instance);
                return;
            }
            instance.inFlight.add(serviceId);
            const previousState = runtime.currentState;
            runtime.currentState = "checking";
            instance.settings.runtime[serviceId] = runtime;
            await this.drawKey(keyAction, instance);
            try {
                const result = await runHealthCheck(resolved);
                const failures = result.ok ? 0 : runtime.consecutiveFailures + 1;
                const successes = result.ok ? runtime.consecutiveSuccesses + 1 : 0;
                // `runtime.currentState` was set to "checking" above, so the state to judge against is the
                // one captured before that, not what is on the runtime now.
                const record = buildCheckRecord(result, evaluateButtonState(resolved, {
                    consecutiveFailures: failures,
                    consecutiveSuccesses: successes,
                    previousState,
                    lastRecord: buildCheckRecord(result, "unknown"),
                }));
                instance.settings.runtime[serviceId] = {
                    history: appendRecord(runtime.history, record),
                    currentState: record.state,
                    consecutiveFailures: failures,
                    consecutiveSuccesses: successes,
                    lastCheckedAt: record.timestamp,
                    lastStatusCode: result.statusCode,
                    lastResponseTimeMs: result.responseTimeMs,
                };
            }
            finally {
                instance.inFlight.delete(serviceId);
            }
            await this.drawKey(keyAction, instance);
        }
        /** Waits for the round's requests to land, bounded so one hung service cannot stall the save. */
        async settle(instance) {
            const deadline = Date.now() + 30_000;
            while (instance.inFlight.size > 0 && Date.now() < deadline)
                await delay(100);
        }
        // ── Persistence and drawing ──────────────────────────────────────────────
        /** Debounced, so a manual check during a round does not write the whole board twice. */
        async persist(keyAction, instance) {
            if (instance.saveTimer)
                clearTimeout(instance.saveTimer);
            instance.saveTimer = setTimeout(() => {
                instance.saveTimer = null;
                void keyAction.setSettings(instance.settings);
            }, 250);
        }
        async drawKey(keyAction, instance) {
            await keyAction.setImage(renderBoardIcon(boardCells(instance.settings)));
        }
        /**
         * Schedules the next round from when the last one ran, not from now.
         *
         * willAppear fires whenever a folder opens, a profile switches, or the app redraws its pages,
         * and a board runs a request per service — so re-checking on every appearance multiplies the
         * waste by the size of the board. The round is anchored to the most recent check on the board
         * instead: return to the page as often as you like and nothing is sent until something is
         * actually due.
         */
        resetTimer(id, keyAction) {
            const instance = this.instances.get(id);
            if (!instance)
                return;
            clearTimer(instance.timer);
            instance.timer = null;
            if (instance.dueTimer)
                clearTimeout(instance.dueTimer);
            instance.dueTimer = null;
            const intervalMs = getIntervalMs(instance.settings.defaults.checkFrequency);
            if (intervalMs === null || instance.settings.services.length === 0)
                return;
            const dueIn = msUntilDue(newestCheck(instance.settings), intervalMs, INITIAL_CHECK_DELAY_MS);
            instance.dueTimer = setTimeout(() => {
                instance.dueTimer = null;
                void this.runRound(id, keyAction);
                instance.timer = startTimer(intervalMs, () => void this.runRound(id, keyAction));
            }, dueIn);
        }
    });
    return _classThis;
})();
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/** A URL is a reasonable name until someone types a better one. */
function hostOf(url) {
    try {
        return new URL(url.trim()).hostname;
    }
    catch {
        return "New service";
    }
}
/**
 * The most recent check anywhere on the board, which is what the round's clock is anchored to.
 *
 * A round checks every service together, so the board has one schedule rather than twelve. A
 * service added since the last round has no timestamp of its own and is checked on the spot when
 * it is added, so it does not need to drag the whole board's clock forward.
 */
function newestCheck(settings) {
    let newest = null;
    for (const service of settings.services) {
        const at = settings.runtime[service.id]?.lastCheckedAt;
        if (at && (!newest || at > newest))
            newest = at;
    }
    return newest;
}

streamDeck.actions.registerAction(new HealthCheckAction());
streamDeck.actions.registerAction(new HealthBoardAction());
streamDeck.connect();
