"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // ../../../ad-motion-verify/node_modules/scheduler/cjs/scheduler.production.js
  var require_scheduler_production = __commonJS({
    "../../../ad-motion-verify/node_modules/scheduler/cjs/scheduler.production.js"(exports) {
      "use strict";
      function push(heap, node) {
        var index = heap.length;
        heap.push(node);
        a: for (; 0 < index; ) {
          var parentIndex = index - 1 >>> 1, parent = heap[parentIndex];
          if (0 < compare(parent, node))
            heap[parentIndex] = node, heap[index] = parent, index = parentIndex;
          else break a;
        }
      }
      function peek(heap) {
        return 0 === heap.length ? null : heap[0];
      }
      function pop(heap) {
        if (0 === heap.length) return null;
        var first = heap[0], last = heap.pop();
        if (last !== first) {
          heap[0] = last;
          a: for (var index = 0, length = heap.length, halfLength = length >>> 1; index < halfLength; ) {
            var leftIndex = 2 * (index + 1) - 1, left = heap[leftIndex], rightIndex = leftIndex + 1, right = heap[rightIndex];
            if (0 > compare(left, last))
              rightIndex < length && 0 > compare(right, left) ? (heap[index] = right, heap[rightIndex] = last, index = rightIndex) : (heap[index] = left, heap[leftIndex] = last, index = leftIndex);
            else if (rightIndex < length && 0 > compare(right, last))
              heap[index] = right, heap[rightIndex] = last, index = rightIndex;
            else break a;
          }
        }
        return first;
      }
      function compare(a, b) {
        var diff = a.sortIndex - b.sortIndex;
        return 0 !== diff ? diff : a.id - b.id;
      }
      exports.unstable_now = void 0;
      if ("object" === typeof performance && "function" === typeof performance.now) {
        localPerformance = performance;
        exports.unstable_now = function() {
          return localPerformance.now();
        };
      } else {
        localDate = Date, initialTime = localDate.now();
        exports.unstable_now = function() {
          return localDate.now() - initialTime;
        };
      }
      var localPerformance;
      var localDate;
      var initialTime;
      var taskQueue = [];
      var timerQueue = [];
      var taskIdCounter = 1;
      var currentTask = null;
      var currentPriorityLevel = 3;
      var isPerformingWork = false;
      var isHostCallbackScheduled = false;
      var isHostTimeoutScheduled = false;
      var localSetTimeout = "function" === typeof setTimeout ? setTimeout : null;
      var localClearTimeout = "function" === typeof clearTimeout ? clearTimeout : null;
      var localSetImmediate = "undefined" !== typeof setImmediate ? setImmediate : null;
      function advanceTimers(currentTime) {
        for (var timer = peek(timerQueue); null !== timer; ) {
          if (null === timer.callback) pop(timerQueue);
          else if (timer.startTime <= currentTime)
            pop(timerQueue), timer.sortIndex = timer.expirationTime, push(taskQueue, timer);
          else break;
          timer = peek(timerQueue);
        }
      }
      function handleTimeout(currentTime) {
        isHostTimeoutScheduled = false;
        advanceTimers(currentTime);
        if (!isHostCallbackScheduled)
          if (null !== peek(taskQueue))
            isHostCallbackScheduled = true, requestHostCallback();
          else {
            var firstTimer = peek(timerQueue);
            null !== firstTimer && requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
          }
      }
      var isMessageLoopRunning = false;
      var taskTimeoutID = -1;
      var frameInterval = 5;
      var startTime = -1;
      function shouldYieldToHost() {
        return exports.unstable_now() - startTime < frameInterval ? false : true;
      }
      function performWorkUntilDeadline() {
        if (isMessageLoopRunning) {
          var currentTime = exports.unstable_now();
          startTime = currentTime;
          var hasMoreWork = true;
          try {
            a: {
              isHostCallbackScheduled = false;
              isHostTimeoutScheduled && (isHostTimeoutScheduled = false, localClearTimeout(taskTimeoutID), taskTimeoutID = -1);
              isPerformingWork = true;
              var previousPriorityLevel = currentPriorityLevel;
              try {
                b: {
                  advanceTimers(currentTime);
                  for (currentTask = peek(taskQueue); null !== currentTask && !(currentTask.expirationTime > currentTime && shouldYieldToHost()); ) {
                    var callback = currentTask.callback;
                    if ("function" === typeof callback) {
                      currentTask.callback = null;
                      currentPriorityLevel = currentTask.priorityLevel;
                      var continuationCallback = callback(
                        currentTask.expirationTime <= currentTime
                      );
                      currentTime = exports.unstable_now();
                      if ("function" === typeof continuationCallback) {
                        currentTask.callback = continuationCallback;
                        advanceTimers(currentTime);
                        hasMoreWork = true;
                        break b;
                      }
                      currentTask === peek(taskQueue) && pop(taskQueue);
                      advanceTimers(currentTime);
                    } else pop(taskQueue);
                    currentTask = peek(taskQueue);
                  }
                  if (null !== currentTask) hasMoreWork = true;
                  else {
                    var firstTimer = peek(timerQueue);
                    null !== firstTimer && requestHostTimeout(
                      handleTimeout,
                      firstTimer.startTime - currentTime
                    );
                    hasMoreWork = false;
                  }
                }
                break a;
              } finally {
                currentTask = null, currentPriorityLevel = previousPriorityLevel, isPerformingWork = false;
              }
              hasMoreWork = void 0;
            }
          } finally {
            hasMoreWork ? schedulePerformWorkUntilDeadline() : isMessageLoopRunning = false;
          }
        }
      }
      var schedulePerformWorkUntilDeadline;
      if ("function" === typeof localSetImmediate)
        schedulePerformWorkUntilDeadline = function() {
          localSetImmediate(performWorkUntilDeadline);
        };
      else if ("undefined" !== typeof MessageChannel) {
        channel = new MessageChannel(), port = channel.port2;
        channel.port1.onmessage = performWorkUntilDeadline;
        schedulePerformWorkUntilDeadline = function() {
          port.postMessage(null);
        };
      } else
        schedulePerformWorkUntilDeadline = function() {
          localSetTimeout(performWorkUntilDeadline, 0);
        };
      var channel;
      var port;
      function requestHostCallback() {
        isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline());
      }
      function requestHostTimeout(callback, ms) {
        taskTimeoutID = localSetTimeout(function() {
          callback(exports.unstable_now());
        }, ms);
      }
      exports.unstable_IdlePriority = 5;
      exports.unstable_ImmediatePriority = 1;
      exports.unstable_LowPriority = 4;
      exports.unstable_NormalPriority = 3;
      exports.unstable_Profiling = null;
      exports.unstable_UserBlockingPriority = 2;
      exports.unstable_cancelCallback = function(task) {
        task.callback = null;
      };
      exports.unstable_continueExecution = function() {
        isHostCallbackScheduled || isPerformingWork || (isHostCallbackScheduled = true, requestHostCallback());
      };
      exports.unstable_forceFrameRate = function(fps) {
        0 > fps || 125 < fps ? console.error(
          "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
        ) : frameInterval = 0 < fps ? Math.floor(1e3 / fps) : 5;
      };
      exports.unstable_getCurrentPriorityLevel = function() {
        return currentPriorityLevel;
      };
      exports.unstable_getFirstCallbackNode = function() {
        return peek(taskQueue);
      };
      exports.unstable_next = function(eventHandler) {
        switch (currentPriorityLevel) {
          case 1:
          case 2:
          case 3:
            var priorityLevel = 3;
            break;
          default:
            priorityLevel = currentPriorityLevel;
        }
        var previousPriorityLevel = currentPriorityLevel;
        currentPriorityLevel = priorityLevel;
        try {
          return eventHandler();
        } finally {
          currentPriorityLevel = previousPriorityLevel;
        }
      };
      exports.unstable_pauseExecution = function() {
      };
      exports.unstable_requestPaint = function() {
      };
      exports.unstable_runWithPriority = function(priorityLevel, eventHandler) {
        switch (priorityLevel) {
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
            break;
          default:
            priorityLevel = 3;
        }
        var previousPriorityLevel = currentPriorityLevel;
        currentPriorityLevel = priorityLevel;
        try {
          return eventHandler();
        } finally {
          currentPriorityLevel = previousPriorityLevel;
        }
      };
      exports.unstable_scheduleCallback = function(priorityLevel, callback, options) {
        var currentTime = exports.unstable_now();
        "object" === typeof options && null !== options ? (options = options.delay, options = "number" === typeof options && 0 < options ? currentTime + options : currentTime) : options = currentTime;
        switch (priorityLevel) {
          case 1:
            var timeout = -1;
            break;
          case 2:
            timeout = 250;
            break;
          case 5:
            timeout = 1073741823;
            break;
          case 4:
            timeout = 1e4;
            break;
          default:
            timeout = 5e3;
        }
        timeout = options + timeout;
        priorityLevel = {
          id: taskIdCounter++,
          callback,
          priorityLevel,
          startTime: options,
          expirationTime: timeout,
          sortIndex: -1
        };
        options > currentTime ? (priorityLevel.sortIndex = options, push(timerQueue, priorityLevel), null === peek(taskQueue) && priorityLevel === peek(timerQueue) && (isHostTimeoutScheduled ? (localClearTimeout(taskTimeoutID), taskTimeoutID = -1) : isHostTimeoutScheduled = true, requestHostTimeout(handleTimeout, options - currentTime))) : (priorityLevel.sortIndex = timeout, push(taskQueue, priorityLevel), isHostCallbackScheduled || isPerformingWork || (isHostCallbackScheduled = true, requestHostCallback()));
        return priorityLevel;
      };
      exports.unstable_shouldYield = shouldYieldToHost;
      exports.unstable_wrapCallback = function(callback) {
        var parentPriorityLevel = currentPriorityLevel;
        return function() {
          var previousPriorityLevel = currentPriorityLevel;
          currentPriorityLevel = parentPriorityLevel;
          try {
            return callback.apply(this, arguments);
          } finally {
            currentPriorityLevel = previousPriorityLevel;
          }
        };
      };
    }
  });

  // ../../../ad-motion-verify/node_modules/scheduler/index.js
  var require_scheduler = __commonJS({
    "../../../ad-motion-verify/node_modules/scheduler/index.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_scheduler_production();
      } else {
        module.exports = null;
      }
    }
  });

  // ../../../ad-motion-verify/node_modules/react/cjs/react.production.js
  var require_react_production = __commonJS({
    "../../../ad-motion-verify/node_modules/react/cjs/react.production.js"(exports) {
      "use strict";
      var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
      var REACT_PORTAL_TYPE = Symbol.for("react.portal");
      var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
      var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
      var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
      var REACT_CONSUMER_TYPE = Symbol.for("react.consumer");
      var REACT_CONTEXT_TYPE = Symbol.for("react.context");
      var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
      var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
      var REACT_MEMO_TYPE = Symbol.for("react.memo");
      var REACT_LAZY_TYPE = Symbol.for("react.lazy");
      var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      var ReactNoopUpdateQueue = {
        isMounted: function() {
          return false;
        },
        enqueueForceUpdate: function() {
        },
        enqueueReplaceState: function() {
        },
        enqueueSetState: function() {
        }
      };
      var assign = Object.assign;
      var emptyObject = {};
      function Component(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      Component.prototype.isReactComponent = {};
      Component.prototype.setState = function(partialState, callback) {
        if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
          throw Error(
            "takes an object of state variables to update or a function which returns an object of state variables."
          );
        this.updater.enqueueSetState(this, partialState, callback, "setState");
      };
      Component.prototype.forceUpdate = function(callback) {
        this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
      };
      function ComponentDummy() {
      }
      ComponentDummy.prototype = Component.prototype;
      function PureComponent(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
      pureComponentPrototype.constructor = PureComponent;
      assign(pureComponentPrototype, Component.prototype);
      pureComponentPrototype.isPureReactComponent = true;
      var isArrayImpl = Array.isArray;
      var ReactSharedInternals = { H: null, A: null, T: null, S: null };
      var hasOwnProperty = Object.prototype.hasOwnProperty;
      function ReactElement(type2, key, self, source, owner, props) {
        self = props.ref;
        return {
          $$typeof: REACT_ELEMENT_TYPE,
          type: type2,
          key,
          ref: void 0 !== self ? self : null,
          props
        };
      }
      function cloneAndReplaceKey(oldElement, newKey) {
        return ReactElement(
          oldElement.type,
          newKey,
          void 0,
          void 0,
          void 0,
          oldElement.props
        );
      }
      function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      function escape(key) {
        var escaperLookup = { "=": "=0", ":": "=2" };
        return "$" + key.replace(/[=:]/g, function(match) {
          return escaperLookup[match];
        });
      }
      var userProvidedKeyEscapeRegex = /\/+/g;
      function getElementKey(element, index) {
        return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
      }
      function noop$1() {
      }
      function resolveThenable(thenable) {
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
          default:
            switch ("string" === typeof thenable.status ? thenable.then(noop$1, noop$1) : (thenable.status = "pending", thenable.then(
              function(fulfilledValue) {
                "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
              },
              function(error) {
                "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            )), thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                throw thenable.reason;
            }
        }
        throw thenable;
      }
      function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
        var type2 = typeof children;
        if ("undefined" === type2 || "boolean" === type2) children = null;
        var invokeCallback = false;
        if (null === children) invokeCallback = true;
        else
          switch (type2) {
            case "bigint":
            case "string":
            case "number":
              invokeCallback = true;
              break;
            case "object":
              switch (children.$$typeof) {
                case REACT_ELEMENT_TYPE:
                case REACT_PORTAL_TYPE:
                  invokeCallback = true;
                  break;
                case REACT_LAZY_TYPE:
                  return invokeCallback = children._init, mapIntoArray(
                    invokeCallback(children._payload),
                    array,
                    escapedPrefix,
                    nameSoFar,
                    callback
                  );
              }
          }
        if (invokeCallback)
          return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
            return c;
          })) : null != callback && (isValidElement(callback) && (callback = cloneAndReplaceKey(
            callback,
            escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(
              userProvidedKeyEscapeRegex,
              "$&/"
            ) + "/") + invokeCallback
          )), array.push(callback)), 1;
        invokeCallback = 0;
        var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
        if (isArrayImpl(children))
          for (var i = 0; i < children.length; i++)
            nameSoFar = children[i], type2 = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type2,
              callback
            );
        else if (i = getIteratorFn(children), "function" === typeof i)
          for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
            nameSoFar = nameSoFar.value, type2 = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type2,
              callback
            );
        else if ("object" === type2) {
          if ("function" === typeof children.then)
            return mapIntoArray(
              resolveThenable(children),
              array,
              escapedPrefix,
              nameSoFar,
              callback
            );
          array = String(children);
          throw Error(
            "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
          );
        }
        return invokeCallback;
      }
      function mapChildren(children, func, context) {
        if (null == children) return children;
        var result = [], count = 0;
        mapIntoArray(children, result, "", "", function(child) {
          return func.call(context, child, count++);
        });
        return result;
      }
      function lazyInitializer(payload) {
        if (-1 === payload._status) {
          var ctor = payload._result;
          ctor = ctor();
          ctor.then(
            function(moduleObject) {
              if (0 === payload._status || -1 === payload._status)
                payload._status = 1, payload._result = moduleObject;
            },
            function(error) {
              if (0 === payload._status || -1 === payload._status)
                payload._status = 2, payload._result = error;
            }
          );
          -1 === payload._status && (payload._status = 0, payload._result = ctor);
        }
        if (1 === payload._status) return payload._result.default;
        throw payload._result;
      }
      var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      };
      function noop() {
      }
      exports.Children = {
        map: mapChildren,
        forEach: function(children, forEachFunc, forEachContext) {
          mapChildren(
            children,
            function() {
              forEachFunc.apply(this, arguments);
            },
            forEachContext
          );
        },
        count: function(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        },
        toArray: function(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        },
        only: function(children) {
          if (!isValidElement(children))
            throw Error(
              "React.Children.only expected to receive a single React element child."
            );
          return children;
        }
      };
      exports.Component = Component;
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.Profiler = REACT_PROFILER_TYPE;
      exports.PureComponent = PureComponent;
      exports.StrictMode = REACT_STRICT_MODE_TYPE;
      exports.Suspense = REACT_SUSPENSE_TYPE;
      exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
      exports.act = function() {
        throw Error("act(...) is not supported in production builds of React.");
      };
      exports.cache = function(fn) {
        return function() {
          return fn.apply(null, arguments);
        };
      };
      exports.cloneElement = function(element, config, children) {
        if (null === element || void 0 === element)
          throw Error(
            "The argument must be a React element, but you passed " + element + "."
          );
        var props = assign({}, element.props), key = element.key, owner = void 0;
        if (null != config)
          for (propName in void 0 !== config.ref && (owner = void 0), void 0 !== config.key && (key = "" + config.key), config)
            !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
        var propName = arguments.length - 2;
        if (1 === propName) props.children = children;
        else if (1 < propName) {
          for (var childArray = Array(propName), i = 0; i < propName; i++)
            childArray[i] = arguments[i + 2];
          props.children = childArray;
        }
        return ReactElement(element.type, key, void 0, void 0, owner, props);
      };
      exports.createContext = function(defaultValue) {
        defaultValue = {
          $$typeof: REACT_CONTEXT_TYPE,
          _currentValue: defaultValue,
          _currentValue2: defaultValue,
          _threadCount: 0,
          Provider: null,
          Consumer: null
        };
        defaultValue.Provider = defaultValue;
        defaultValue.Consumer = {
          $$typeof: REACT_CONSUMER_TYPE,
          _context: defaultValue
        };
        return defaultValue;
      };
      exports.createElement = function(type2, config, children) {
        var propName, props = {}, key = null;
        if (null != config)
          for (propName in void 0 !== config.key && (key = "" + config.key), config)
            hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
        var childrenLength = arguments.length - 2;
        if (1 === childrenLength) props.children = children;
        else if (1 < childrenLength) {
          for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++)
            childArray[i] = arguments[i + 2];
          props.children = childArray;
        }
        if (type2 && type2.defaultProps)
          for (propName in childrenLength = type2.defaultProps, childrenLength)
            void 0 === props[propName] && (props[propName] = childrenLength[propName]);
        return ReactElement(type2, key, void 0, void 0, null, props);
      };
      exports.createRef = function() {
        return { current: null };
      };
      exports.forwardRef = function(render) {
        return { $$typeof: REACT_FORWARD_REF_TYPE, render };
      };
      exports.isValidElement = isValidElement;
      exports.lazy = function(ctor) {
        return {
          $$typeof: REACT_LAZY_TYPE,
          _payload: { _status: -1, _result: ctor },
          _init: lazyInitializer
        };
      };
      exports.memo = function(type2, compare) {
        return {
          $$typeof: REACT_MEMO_TYPE,
          type: type2,
          compare: void 0 === compare ? null : compare
        };
      };
      exports.startTransition = function(scope) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        ReactSharedInternals.T = currentTransition;
        try {
          var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
        } catch (error) {
          reportGlobalError(error);
        } finally {
          ReactSharedInternals.T = prevTransition;
        }
      };
      exports.unstable_useCacheRefresh = function() {
        return ReactSharedInternals.H.useCacheRefresh();
      };
      exports.use = function(usable) {
        return ReactSharedInternals.H.use(usable);
      };
      exports.useActionState = function(action, initialState, permalink) {
        return ReactSharedInternals.H.useActionState(action, initialState, permalink);
      };
      exports.useCallback = function(callback, deps) {
        return ReactSharedInternals.H.useCallback(callback, deps);
      };
      exports.useContext = function(Context) {
        return ReactSharedInternals.H.useContext(Context);
      };
      exports.useDebugValue = function() {
      };
      exports.useDeferredValue = function(value, initialValue) {
        return ReactSharedInternals.H.useDeferredValue(value, initialValue);
      };
      exports.useEffect = function(create, deps) {
        return ReactSharedInternals.H.useEffect(create, deps);
      };
      exports.useId = function() {
        return ReactSharedInternals.H.useId();
      };
      exports.useImperativeHandle = function(ref, create, deps) {
        return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
      };
      exports.useInsertionEffect = function(create, deps) {
        return ReactSharedInternals.H.useInsertionEffect(create, deps);
      };
      exports.useLayoutEffect = function(create, deps) {
        return ReactSharedInternals.H.useLayoutEffect(create, deps);
      };
      exports.useMemo = function(create, deps) {
        return ReactSharedInternals.H.useMemo(create, deps);
      };
      exports.useOptimistic = function(passthrough, reducer) {
        return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
      };
      exports.useReducer = function(reducer, initialArg, init) {
        return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
      };
      exports.useRef = function(initialValue) {
        return ReactSharedInternals.H.useRef(initialValue);
      };
      exports.useState = function(initialState) {
        return ReactSharedInternals.H.useState(initialState);
      };
      exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
        return ReactSharedInternals.H.useSyncExternalStore(
          subscribe,
          getSnapshot,
          getServerSnapshot
        );
      };
      exports.useTransition = function() {
        return ReactSharedInternals.H.useTransition();
      };
      exports.version = "19.0.0";
    }
  });

  // ../../../ad-motion-verify/node_modules/react/index.js
  var require_react = __commonJS({
    "../../../ad-motion-verify/node_modules/react/index.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_react_production();
      } else {
        module.exports = null;
      }
    }
  });

  // ../../../ad-motion-verify/node_modules/react-dom/cjs/react-dom.production.js
  var require_react_dom_production = __commonJS({
    "../../../ad-motion-verify/node_modules/react-dom/cjs/react-dom.production.js"(exports) {
      "use strict";
      var React = require_react();
      function formatProdErrorMessage(code) {
        var url = "https://react.dev/errors/" + code;
        if (1 < arguments.length) {
          url += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var i = 2; i < arguments.length; i++)
            url += "&args[]=" + encodeURIComponent(arguments[i]);
        }
        return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function noop() {
      }
      var Internals = {
        d: {
          f: noop,
          r: function() {
            throw Error(formatProdErrorMessage(522));
          },
          D: noop,
          C: noop,
          L: noop,
          m: noop,
          X: noop,
          S: noop,
          M: noop
        },
        p: 0,
        findDOMNode: null
      };
      var REACT_PORTAL_TYPE = Symbol.for("react.portal");
      function createPortal$1(children, containerInfo, implementation) {
        var key = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
        return {
          $$typeof: REACT_PORTAL_TYPE,
          key: null == key ? null : "" + key,
          children,
          containerInfo,
          implementation
        };
      }
      var ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      function getCrossOriginStringAs(as, input) {
        if ("font" === as) return "";
        if ("string" === typeof input)
          return "use-credentials" === input ? input : "";
      }
      exports.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Internals;
      exports.createPortal = function(children, container) {
        var key = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
        if (!container || 1 !== container.nodeType && 9 !== container.nodeType && 11 !== container.nodeType)
          throw Error(formatProdErrorMessage(299));
        return createPortal$1(children, container, null, key);
      };
      exports.flushSync = function(fn) {
        var previousTransition = ReactSharedInternals.T, previousUpdatePriority = Internals.p;
        try {
          if (ReactSharedInternals.T = null, Internals.p = 2, fn) return fn();
        } finally {
          ReactSharedInternals.T = previousTransition, Internals.p = previousUpdatePriority, Internals.d.f();
        }
      };
      exports.preconnect = function(href, options) {
        "string" === typeof href && (options ? (options = options.crossOrigin, options = "string" === typeof options ? "use-credentials" === options ? options : "" : void 0) : options = null, Internals.d.C(href, options));
      };
      exports.prefetchDNS = function(href) {
        "string" === typeof href && Internals.d.D(href);
      };
      exports.preinit = function(href, options) {
        if ("string" === typeof href && options && "string" === typeof options.as) {
          var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin), integrity = "string" === typeof options.integrity ? options.integrity : void 0, fetchPriority = "string" === typeof options.fetchPriority ? options.fetchPriority : void 0;
          "style" === as ? Internals.d.S(
            href,
            "string" === typeof options.precedence ? options.precedence : void 0,
            {
              crossOrigin,
              integrity,
              fetchPriority
            }
          ) : "script" === as && Internals.d.X(href, {
            crossOrigin,
            integrity,
            fetchPriority,
            nonce: "string" === typeof options.nonce ? options.nonce : void 0
          });
        }
      };
      exports.preinitModule = function(href, options) {
        if ("string" === typeof href)
          if ("object" === typeof options && null !== options) {
            if (null == options.as || "script" === options.as) {
              var crossOrigin = getCrossOriginStringAs(
                options.as,
                options.crossOrigin
              );
              Internals.d.M(href, {
                crossOrigin,
                integrity: "string" === typeof options.integrity ? options.integrity : void 0,
                nonce: "string" === typeof options.nonce ? options.nonce : void 0
              });
            }
          } else null == options && Internals.d.M(href);
      };
      exports.preload = function(href, options) {
        if ("string" === typeof href && "object" === typeof options && null !== options && "string" === typeof options.as) {
          var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin);
          Internals.d.L(href, as, {
            crossOrigin,
            integrity: "string" === typeof options.integrity ? options.integrity : void 0,
            nonce: "string" === typeof options.nonce ? options.nonce : void 0,
            type: "string" === typeof options.type ? options.type : void 0,
            fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0,
            referrerPolicy: "string" === typeof options.referrerPolicy ? options.referrerPolicy : void 0,
            imageSrcSet: "string" === typeof options.imageSrcSet ? options.imageSrcSet : void 0,
            imageSizes: "string" === typeof options.imageSizes ? options.imageSizes : void 0,
            media: "string" === typeof options.media ? options.media : void 0
          });
        }
      };
      exports.preloadModule = function(href, options) {
        if ("string" === typeof href)
          if (options) {
            var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
            Internals.d.m(href, {
              as: "string" === typeof options.as && "script" !== options.as ? options.as : void 0,
              crossOrigin,
              integrity: "string" === typeof options.integrity ? options.integrity : void 0
            });
          } else Internals.d.m(href);
      };
      exports.requestFormReset = function(form) {
        Internals.d.r(form);
      };
      exports.unstable_batchedUpdates = function(fn, a) {
        return fn(a);
      };
      exports.useFormState = function(action, initialState, permalink) {
        return ReactSharedInternals.H.useFormState(action, initialState, permalink);
      };
      exports.useFormStatus = function() {
        return ReactSharedInternals.H.useHostTransitionStatus();
      };
      exports.version = "19.0.0";
    }
  });

  // ../../../ad-motion-verify/node_modules/react-dom/index.js
  var require_react_dom = __commonJS({
    "../../../ad-motion-verify/node_modules/react-dom/index.js"(exports, module) {
      "use strict";
      function checkDCE() {
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
          return;
        }
        if (false) {
          throw new Error("^_^");
        }
        try {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
        } catch (err) {
          console.error(err);
        }
      }
      if (true) {
        checkDCE();
        module.exports = require_react_dom_production();
      } else {
        module.exports = null;
      }
    }
  });

  // ../../../ad-motion-verify/node_modules/react-dom/cjs/react-dom-client.production.js
  var require_react_dom_client_production = __commonJS({
    "../../../ad-motion-verify/node_modules/react-dom/cjs/react-dom-client.production.js"(exports) {
      "use strict";
      var Scheduler = require_scheduler();
      var React = require_react();
      var ReactDOM = require_react_dom();
      function formatProdErrorMessage(code) {
        var url = "https://react.dev/errors/" + code;
        if (1 < arguments.length) {
          url += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var i = 2; i < arguments.length; i++)
            url += "&args[]=" + encodeURIComponent(arguments[i]);
        }
        return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function isValidContainer(node) {
        return !(!node || 1 !== node.nodeType && 9 !== node.nodeType && 11 !== node.nodeType);
      }
      var REACT_LEGACY_ELEMENT_TYPE = Symbol.for("react.element");
      var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
      var REACT_PORTAL_TYPE = Symbol.for("react.portal");
      var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
      var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
      var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
      var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
      var REACT_CONSUMER_TYPE = Symbol.for("react.consumer");
      var REACT_CONTEXT_TYPE = Symbol.for("react.context");
      var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
      var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
      var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
      var REACT_MEMO_TYPE = Symbol.for("react.memo");
      var REACT_LAZY_TYPE = Symbol.for("react.lazy");
      Symbol.for("react.scope");
      Symbol.for("react.debug_trace_mode");
      var REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
      Symbol.for("react.legacy_hidden");
      Symbol.for("react.tracing_marker");
      var REACT_MEMO_CACHE_SENTINEL = Symbol.for("react.memo_cache_sentinel");
      var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      var REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference");
      function getComponentNameFromType(type2) {
        if (null == type2) return null;
        if ("function" === typeof type2)
          return type2.$$typeof === REACT_CLIENT_REFERENCE ? null : type2.displayName || type2.name || null;
        if ("string" === typeof type2) return type2;
        switch (type2) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PORTAL_TYPE:
            return "Portal";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
        }
        if ("object" === typeof type2)
          switch (type2.$$typeof) {
            case REACT_CONTEXT_TYPE:
              return (type2.displayName || "Context") + ".Provider";
            case REACT_CONSUMER_TYPE:
              return (type2._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type2.render;
              type2 = type2.displayName;
              type2 || (type2 = innerType.displayName || innerType.name || "", type2 = "" !== type2 ? "ForwardRef(" + type2 + ")" : "ForwardRef");
              return type2;
            case REACT_MEMO_TYPE:
              return innerType = type2.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type2.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type2._payload;
              type2 = type2._init;
              try {
                return getComponentNameFromType(type2(innerType));
              } catch (x) {
              }
          }
        return null;
      }
      var ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      var assign = Object.assign;
      var prefix;
      var suffix;
      function describeBuiltInComponentFrame(name) {
        if (void 0 === prefix)
          try {
            throw Error();
          } catch (x) {
            var match = x.stack.trim().match(/\n( *(at )?)/);
            prefix = match && match[1] || "";
            suffix = -1 < x.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < x.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return "\n" + prefix + name + suffix;
      }
      var reentry = false;
      function describeNativeComponentFrame(fn, construct) {
        if (!fn || reentry) return "";
        reentry = true;
        var previousPrepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var RunInRootFrame = {
            DetermineComponentFrameRoot: function() {
              try {
                if (construct) {
                  var Fake = function() {
                    throw Error();
                  };
                  Object.defineProperty(Fake.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  });
                  if ("object" === typeof Reflect && Reflect.construct) {
                    try {
                      Reflect.construct(Fake, []);
                    } catch (x) {
                      var control = x;
                    }
                    Reflect.construct(fn, [], Fake);
                  } else {
                    try {
                      Fake.call();
                    } catch (x$0) {
                      control = x$0;
                    }
                    fn.call(Fake.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (x$1) {
                    control = x$1;
                  }
                  (Fake = fn()) && "function" === typeof Fake.catch && Fake.catch(function() {
                  });
                }
              } catch (sample) {
                if (sample && control && "string" === typeof sample.stack)
                  return [sample.stack, control.stack];
              }
              return [null, null];
            }
          };
          RunInRootFrame.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
          var namePropDescriptor = Object.getOwnPropertyDescriptor(
            RunInRootFrame.DetermineComponentFrameRoot,
            "name"
          );
          namePropDescriptor && namePropDescriptor.configurable && Object.defineProperty(
            RunInRootFrame.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var _RunInRootFrame$Deter = RunInRootFrame.DetermineComponentFrameRoot(), sampleStack = _RunInRootFrame$Deter[0], controlStack = _RunInRootFrame$Deter[1];
          if (sampleStack && controlStack) {
            var sampleLines = sampleStack.split("\n"), controlLines = controlStack.split("\n");
            for (namePropDescriptor = RunInRootFrame = 0; RunInRootFrame < sampleLines.length && !sampleLines[RunInRootFrame].includes("DetermineComponentFrameRoot"); )
              RunInRootFrame++;
            for (; namePropDescriptor < controlLines.length && !controlLines[namePropDescriptor].includes(
              "DetermineComponentFrameRoot"
            ); )
              namePropDescriptor++;
            if (RunInRootFrame === sampleLines.length || namePropDescriptor === controlLines.length)
              for (RunInRootFrame = sampleLines.length - 1, namePropDescriptor = controlLines.length - 1; 1 <= RunInRootFrame && 0 <= namePropDescriptor && sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]; )
                namePropDescriptor--;
            for (; 1 <= RunInRootFrame && 0 <= namePropDescriptor; RunInRootFrame--, namePropDescriptor--)
              if (sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]) {
                if (1 !== RunInRootFrame || 1 !== namePropDescriptor) {
                  do
                    if (RunInRootFrame--, namePropDescriptor--, 0 > namePropDescriptor || sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]) {
                      var frame = "\n" + sampleLines[RunInRootFrame].replace(" at new ", " at ");
                      fn.displayName && frame.includes("<anonymous>") && (frame = frame.replace("<anonymous>", fn.displayName));
                      return frame;
                    }
                  while (1 <= RunInRootFrame && 0 <= namePropDescriptor);
                }
                break;
              }
          }
        } finally {
          reentry = false, Error.prepareStackTrace = previousPrepareStackTrace;
        }
        return (previousPrepareStackTrace = fn ? fn.displayName || fn.name : "") ? describeBuiltInComponentFrame(previousPrepareStackTrace) : "";
      }
      function describeFiber(fiber) {
        switch (fiber.tag) {
          case 26:
          case 27:
          case 5:
            return describeBuiltInComponentFrame(fiber.type);
          case 16:
            return describeBuiltInComponentFrame("Lazy");
          case 13:
            return describeBuiltInComponentFrame("Suspense");
          case 19:
            return describeBuiltInComponentFrame("SuspenseList");
          case 0:
          case 15:
            return fiber = describeNativeComponentFrame(fiber.type, false), fiber;
          case 11:
            return fiber = describeNativeComponentFrame(fiber.type.render, false), fiber;
          case 1:
            return fiber = describeNativeComponentFrame(fiber.type, true), fiber;
          default:
            return "";
        }
      }
      function getStackByFiberInDevAndProd(workInProgress2) {
        try {
          var info = "";
          do
            info += describeFiber(workInProgress2), workInProgress2 = workInProgress2.return;
          while (workInProgress2);
          return info;
        } catch (x) {
          return "\nError generating stack: " + x.message + "\n" + x.stack;
        }
      }
      function getNearestMountedFiber(fiber) {
        var node = fiber, nearestMounted = fiber;
        if (fiber.alternate) for (; node.return; ) node = node.return;
        else {
          fiber = node;
          do
            node = fiber, 0 !== (node.flags & 4098) && (nearestMounted = node.return), fiber = node.return;
          while (fiber);
        }
        return 3 === node.tag ? nearestMounted : null;
      }
      function getSuspenseInstanceFromFiber(fiber) {
        if (13 === fiber.tag) {
          var suspenseState = fiber.memoizedState;
          null === suspenseState && (fiber = fiber.alternate, null !== fiber && (suspenseState = fiber.memoizedState));
          if (null !== suspenseState) return suspenseState.dehydrated;
        }
        return null;
      }
      function assertIsMounted(fiber) {
        if (getNearestMountedFiber(fiber) !== fiber)
          throw Error(formatProdErrorMessage(188));
      }
      function findCurrentFiberUsingSlowPath(fiber) {
        var alternate = fiber.alternate;
        if (!alternate) {
          alternate = getNearestMountedFiber(fiber);
          if (null === alternate) throw Error(formatProdErrorMessage(188));
          return alternate !== fiber ? null : fiber;
        }
        for (var a = fiber, b = alternate; ; ) {
          var parentA = a.return;
          if (null === parentA) break;
          var parentB = parentA.alternate;
          if (null === parentB) {
            b = parentA.return;
            if (null !== b) {
              a = b;
              continue;
            }
            break;
          }
          if (parentA.child === parentB.child) {
            for (parentB = parentA.child; parentB; ) {
              if (parentB === a) return assertIsMounted(parentA), fiber;
              if (parentB === b) return assertIsMounted(parentA), alternate;
              parentB = parentB.sibling;
            }
            throw Error(formatProdErrorMessage(188));
          }
          if (a.return !== b.return) a = parentA, b = parentB;
          else {
            for (var didFindChild = false, child$2 = parentA.child; child$2; ) {
              if (child$2 === a) {
                didFindChild = true;
                a = parentA;
                b = parentB;
                break;
              }
              if (child$2 === b) {
                didFindChild = true;
                b = parentA;
                a = parentB;
                break;
              }
              child$2 = child$2.sibling;
            }
            if (!didFindChild) {
              for (child$2 = parentB.child; child$2; ) {
                if (child$2 === a) {
                  didFindChild = true;
                  a = parentB;
                  b = parentA;
                  break;
                }
                if (child$2 === b) {
                  didFindChild = true;
                  b = parentB;
                  a = parentA;
                  break;
                }
                child$2 = child$2.sibling;
              }
              if (!didFindChild) throw Error(formatProdErrorMessage(189));
            }
          }
          if (a.alternate !== b) throw Error(formatProdErrorMessage(190));
        }
        if (3 !== a.tag) throw Error(formatProdErrorMessage(188));
        return a.stateNode.current === a ? fiber : alternate;
      }
      function findCurrentHostFiberImpl(node) {
        var tag = node.tag;
        if (5 === tag || 26 === tag || 27 === tag || 6 === tag) return node;
        for (node = node.child; null !== node; ) {
          tag = findCurrentHostFiberImpl(node);
          if (null !== tag) return tag;
          node = node.sibling;
        }
        return null;
      }
      var isArrayImpl = Array.isArray;
      var ReactDOMSharedInternals = ReactDOM.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      var sharedNotPendingObject = {
        pending: false,
        data: null,
        method: null,
        action: null
      };
      var valueStack = [];
      var index = -1;
      function createCursor(defaultValue) {
        return { current: defaultValue };
      }
      function pop(cursor) {
        0 > index || (cursor.current = valueStack[index], valueStack[index] = null, index--);
      }
      function push(cursor, value) {
        index++;
        valueStack[index] = cursor.current;
        cursor.current = value;
      }
      var contextStackCursor = createCursor(null);
      var contextFiberStackCursor = createCursor(null);
      var rootInstanceStackCursor = createCursor(null);
      var hostTransitionProviderCursor = createCursor(null);
      function pushHostContainer(fiber, nextRootInstance) {
        push(rootInstanceStackCursor, nextRootInstance);
        push(contextFiberStackCursor, fiber);
        push(contextStackCursor, null);
        fiber = nextRootInstance.nodeType;
        switch (fiber) {
          case 9:
          case 11:
            nextRootInstance = (nextRootInstance = nextRootInstance.documentElement) ? (nextRootInstance = nextRootInstance.namespaceURI) ? getOwnHostContext(nextRootInstance) : 0 : 0;
            break;
          default:
            if (fiber = 8 === fiber ? nextRootInstance.parentNode : nextRootInstance, nextRootInstance = fiber.tagName, fiber = fiber.namespaceURI)
              fiber = getOwnHostContext(fiber), nextRootInstance = getChildHostContextProd(fiber, nextRootInstance);
            else
              switch (nextRootInstance) {
                case "svg":
                  nextRootInstance = 1;
                  break;
                case "math":
                  nextRootInstance = 2;
                  break;
                default:
                  nextRootInstance = 0;
              }
        }
        pop(contextStackCursor);
        push(contextStackCursor, nextRootInstance);
      }
      function popHostContainer() {
        pop(contextStackCursor);
        pop(contextFiberStackCursor);
        pop(rootInstanceStackCursor);
      }
      function pushHostContext(fiber) {
        null !== fiber.memoizedState && push(hostTransitionProviderCursor, fiber);
        var context = contextStackCursor.current;
        var JSCompiler_inline_result = getChildHostContextProd(context, fiber.type);
        context !== JSCompiler_inline_result && (push(contextFiberStackCursor, fiber), push(contextStackCursor, JSCompiler_inline_result));
      }
      function popHostContext(fiber) {
        contextFiberStackCursor.current === fiber && (pop(contextStackCursor), pop(contextFiberStackCursor));
        hostTransitionProviderCursor.current === fiber && (pop(hostTransitionProviderCursor), HostTransitionContext._currentValue = sharedNotPendingObject);
      }
      var hasOwnProperty = Object.prototype.hasOwnProperty;
      var scheduleCallback$3 = Scheduler.unstable_scheduleCallback;
      var cancelCallback$1 = Scheduler.unstable_cancelCallback;
      var shouldYield = Scheduler.unstable_shouldYield;
      var requestPaint = Scheduler.unstable_requestPaint;
      var now = Scheduler.unstable_now;
      var getCurrentPriorityLevel = Scheduler.unstable_getCurrentPriorityLevel;
      var ImmediatePriority = Scheduler.unstable_ImmediatePriority;
      var UserBlockingPriority = Scheduler.unstable_UserBlockingPriority;
      var NormalPriority$1 = Scheduler.unstable_NormalPriority;
      var LowPriority = Scheduler.unstable_LowPriority;
      var IdlePriority = Scheduler.unstable_IdlePriority;
      var log$1 = Scheduler.log;
      var unstable_setDisableYieldValue = Scheduler.unstable_setDisableYieldValue;
      var rendererID = null;
      var injectedHook = null;
      function onCommitRoot(root2) {
        if (injectedHook && "function" === typeof injectedHook.onCommitFiberRoot)
          try {
            injectedHook.onCommitFiberRoot(
              rendererID,
              root2,
              void 0,
              128 === (root2.current.flags & 128)
            );
          } catch (err) {
          }
      }
      function setIsStrictModeForDevtools(newIsStrictMode) {
        "function" === typeof log$1 && unstable_setDisableYieldValue(newIsStrictMode);
        if (injectedHook && "function" === typeof injectedHook.setStrictMode)
          try {
            injectedHook.setStrictMode(rendererID, newIsStrictMode);
          } catch (err) {
          }
      }
      var clz32 = Math.clz32 ? Math.clz32 : clz32Fallback;
      var log = Math.log;
      var LN2 = Math.LN2;
      function clz32Fallback(x) {
        x >>>= 0;
        return 0 === x ? 32 : 31 - (log(x) / LN2 | 0) | 0;
      }
      var nextTransitionLane = 128;
      var nextRetryLane = 4194304;
      function getHighestPriorityLanes(lanes) {
        var pendingSyncLanes = lanes & 42;
        if (0 !== pendingSyncLanes) return pendingSyncLanes;
        switch (lanes & -lanes) {
          case 1:
            return 1;
          case 2:
            return 2;
          case 4:
            return 4;
          case 8:
            return 8;
          case 16:
            return 16;
          case 32:
            return 32;
          case 64:
            return 64;
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return lanes & 4194176;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            return lanes & 62914560;
          case 67108864:
            return 67108864;
          case 134217728:
            return 134217728;
          case 268435456:
            return 268435456;
          case 536870912:
            return 536870912;
          case 1073741824:
            return 0;
          default:
            return lanes;
        }
      }
      function getNextLanes(root2, wipLanes) {
        var pendingLanes = root2.pendingLanes;
        if (0 === pendingLanes) return 0;
        var nextLanes = 0, suspendedLanes = root2.suspendedLanes, pingedLanes = root2.pingedLanes, warmLanes = root2.warmLanes;
        root2 = 0 !== root2.finishedLanes;
        var nonIdlePendingLanes = pendingLanes & 134217727;
        0 !== nonIdlePendingLanes ? (pendingLanes = nonIdlePendingLanes & ~suspendedLanes, 0 !== pendingLanes ? nextLanes = getHighestPriorityLanes(pendingLanes) : (pingedLanes &= nonIdlePendingLanes, 0 !== pingedLanes ? nextLanes = getHighestPriorityLanes(pingedLanes) : root2 || (warmLanes = nonIdlePendingLanes & ~warmLanes, 0 !== warmLanes && (nextLanes = getHighestPriorityLanes(warmLanes))))) : (nonIdlePendingLanes = pendingLanes & ~suspendedLanes, 0 !== nonIdlePendingLanes ? nextLanes = getHighestPriorityLanes(nonIdlePendingLanes) : 0 !== pingedLanes ? nextLanes = getHighestPriorityLanes(pingedLanes) : root2 || (warmLanes = pendingLanes & ~warmLanes, 0 !== warmLanes && (nextLanes = getHighestPriorityLanes(warmLanes))));
        return 0 === nextLanes ? 0 : 0 !== wipLanes && wipLanes !== nextLanes && 0 === (wipLanes & suspendedLanes) && (suspendedLanes = nextLanes & -nextLanes, warmLanes = wipLanes & -wipLanes, suspendedLanes >= warmLanes || 32 === suspendedLanes && 0 !== (warmLanes & 4194176)) ? wipLanes : nextLanes;
      }
      function checkIfRootIsPrerendering(root2, renderLanes2) {
        return 0 === (root2.pendingLanes & ~(root2.suspendedLanes & ~root2.pingedLanes) & renderLanes2);
      }
      function computeExpirationTime(lane, currentTime) {
        switch (lane) {
          case 1:
          case 2:
          case 4:
          case 8:
            return currentTime + 250;
          case 16:
          case 32:
          case 64:
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return currentTime + 5e3;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            return -1;
          case 67108864:
          case 134217728:
          case 268435456:
          case 536870912:
          case 1073741824:
            return -1;
          default:
            return -1;
        }
      }
      function claimNextTransitionLane() {
        var lane = nextTransitionLane;
        nextTransitionLane <<= 1;
        0 === (nextTransitionLane & 4194176) && (nextTransitionLane = 128);
        return lane;
      }
      function claimNextRetryLane() {
        var lane = nextRetryLane;
        nextRetryLane <<= 1;
        0 === (nextRetryLane & 62914560) && (nextRetryLane = 4194304);
        return lane;
      }
      function createLaneMap(initial) {
        for (var laneMap = [], i = 0; 31 > i; i++) laneMap.push(initial);
        return laneMap;
      }
      function markRootUpdated$1(root2, updateLane) {
        root2.pendingLanes |= updateLane;
        268435456 !== updateLane && (root2.suspendedLanes = 0, root2.pingedLanes = 0, root2.warmLanes = 0);
      }
      function markRootFinished(root2, finishedLanes, remainingLanes, spawnedLane, updatedLanes, suspendedRetryLanes) {
        var previouslyPendingLanes = root2.pendingLanes;
        root2.pendingLanes = remainingLanes;
        root2.suspendedLanes = 0;
        root2.pingedLanes = 0;
        root2.warmLanes = 0;
        root2.expiredLanes &= remainingLanes;
        root2.entangledLanes &= remainingLanes;
        root2.errorRecoveryDisabledLanes &= remainingLanes;
        root2.shellSuspendCounter = 0;
        var entanglements = root2.entanglements, expirationTimes = root2.expirationTimes, hiddenUpdates = root2.hiddenUpdates;
        for (remainingLanes = previouslyPendingLanes & ~remainingLanes; 0 < remainingLanes; ) {
          var index$7 = 31 - clz32(remainingLanes), lane = 1 << index$7;
          entanglements[index$7] = 0;
          expirationTimes[index$7] = -1;
          var hiddenUpdatesForLane = hiddenUpdates[index$7];
          if (null !== hiddenUpdatesForLane)
            for (hiddenUpdates[index$7] = null, index$7 = 0; index$7 < hiddenUpdatesForLane.length; index$7++) {
              var update = hiddenUpdatesForLane[index$7];
              null !== update && (update.lane &= -536870913);
            }
          remainingLanes &= ~lane;
        }
        0 !== spawnedLane && markSpawnedDeferredLane(root2, spawnedLane, 0);
        0 !== suspendedRetryLanes && 0 === updatedLanes && 0 !== root2.tag && (root2.suspendedLanes |= suspendedRetryLanes & ~(previouslyPendingLanes & ~finishedLanes));
      }
      function markSpawnedDeferredLane(root2, spawnedLane, entangledLanes) {
        root2.pendingLanes |= spawnedLane;
        root2.suspendedLanes &= ~spawnedLane;
        var spawnedLaneIndex = 31 - clz32(spawnedLane);
        root2.entangledLanes |= spawnedLane;
        root2.entanglements[spawnedLaneIndex] = root2.entanglements[spawnedLaneIndex] | 1073741824 | entangledLanes & 4194218;
      }
      function markRootEntangled(root2, entangledLanes) {
        var rootEntangledLanes = root2.entangledLanes |= entangledLanes;
        for (root2 = root2.entanglements; rootEntangledLanes; ) {
          var index$8 = 31 - clz32(rootEntangledLanes), lane = 1 << index$8;
          lane & entangledLanes | root2[index$8] & entangledLanes && (root2[index$8] |= entangledLanes);
          rootEntangledLanes &= ~lane;
        }
      }
      function lanesToEventPriority(lanes) {
        lanes &= -lanes;
        return 2 < lanes ? 8 < lanes ? 0 !== (lanes & 134217727) ? 32 : 268435456 : 8 : 2;
      }
      function resolveUpdatePriority() {
        var updatePriority = ReactDOMSharedInternals.p;
        if (0 !== updatePriority) return updatePriority;
        updatePriority = window.event;
        return void 0 === updatePriority ? 32 : getEventPriority(updatePriority.type);
      }
      function runWithPriority(priority, fn) {
        var previousPriority = ReactDOMSharedInternals.p;
        try {
          return ReactDOMSharedInternals.p = priority, fn();
        } finally {
          ReactDOMSharedInternals.p = previousPriority;
        }
      }
      var randomKey = Math.random().toString(36).slice(2);
      var internalInstanceKey = "__reactFiber$" + randomKey;
      var internalPropsKey = "__reactProps$" + randomKey;
      var internalContainerInstanceKey = "__reactContainer$" + randomKey;
      var internalEventHandlersKey = "__reactEvents$" + randomKey;
      var internalEventHandlerListenersKey = "__reactListeners$" + randomKey;
      var internalEventHandlesSetKey = "__reactHandles$" + randomKey;
      var internalRootNodeResourcesKey = "__reactResources$" + randomKey;
      var internalHoistableMarker = "__reactMarker$" + randomKey;
      function detachDeletedInstance(node) {
        delete node[internalInstanceKey];
        delete node[internalPropsKey];
        delete node[internalEventHandlersKey];
        delete node[internalEventHandlerListenersKey];
        delete node[internalEventHandlesSetKey];
      }
      function getClosestInstanceFromNode(targetNode) {
        var targetInst = targetNode[internalInstanceKey];
        if (targetInst) return targetInst;
        for (var parentNode = targetNode.parentNode; parentNode; ) {
          if (targetInst = parentNode[internalContainerInstanceKey] || parentNode[internalInstanceKey]) {
            parentNode = targetInst.alternate;
            if (null !== targetInst.child || null !== parentNode && null !== parentNode.child)
              for (targetNode = getParentSuspenseInstance(targetNode); null !== targetNode; ) {
                if (parentNode = targetNode[internalInstanceKey]) return parentNode;
                targetNode = getParentSuspenseInstance(targetNode);
              }
            return targetInst;
          }
          targetNode = parentNode;
          parentNode = targetNode.parentNode;
        }
        return null;
      }
      function getInstanceFromNode(node) {
        if (node = node[internalInstanceKey] || node[internalContainerInstanceKey]) {
          var tag = node.tag;
          if (5 === tag || 6 === tag || 13 === tag || 26 === tag || 27 === tag || 3 === tag)
            return node;
        }
        return null;
      }
      function getNodeFromInstance(inst) {
        var tag = inst.tag;
        if (5 === tag || 26 === tag || 27 === tag || 6 === tag) return inst.stateNode;
        throw Error(formatProdErrorMessage(33));
      }
      function getResourcesFromRoot(root2) {
        var resources = root2[internalRootNodeResourcesKey];
        resources || (resources = root2[internalRootNodeResourcesKey] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() });
        return resources;
      }
      function markNodeAsHoistable(node) {
        node[internalHoistableMarker] = true;
      }
      var allNativeEvents = /* @__PURE__ */ new Set();
      var registrationNameDependencies = {};
      function registerTwoPhaseEvent(registrationName, dependencies) {
        registerDirectEvent(registrationName, dependencies);
        registerDirectEvent(registrationName + "Capture", dependencies);
      }
      function registerDirectEvent(registrationName, dependencies) {
        registrationNameDependencies[registrationName] = dependencies;
        for (registrationName = 0; registrationName < dependencies.length; registrationName++)
          allNativeEvents.add(dependencies[registrationName]);
      }
      var canUseDOM = !("undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement);
      var VALID_ATTRIBUTE_NAME_REGEX = RegExp(
        "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
      );
      var illegalAttributeNameCache = {};
      var validatedAttributeNameCache = {};
      function isAttributeNameSafe(attributeName) {
        if (hasOwnProperty.call(validatedAttributeNameCache, attributeName))
          return true;
        if (hasOwnProperty.call(illegalAttributeNameCache, attributeName)) return false;
        if (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName))
          return validatedAttributeNameCache[attributeName] = true;
        illegalAttributeNameCache[attributeName] = true;
        return false;
      }
      function setValueForAttribute(node, name, value) {
        if (isAttributeNameSafe(name))
          if (null === value) node.removeAttribute(name);
          else {
            switch (typeof value) {
              case "undefined":
              case "function":
              case "symbol":
                node.removeAttribute(name);
                return;
              case "boolean":
                var prefix$10 = name.toLowerCase().slice(0, 5);
                if ("data-" !== prefix$10 && "aria-" !== prefix$10) {
                  node.removeAttribute(name);
                  return;
                }
            }
            node.setAttribute(name, "" + value);
          }
      }
      function setValueForKnownAttribute(node, name, value) {
        if (null === value) node.removeAttribute(name);
        else {
          switch (typeof value) {
            case "undefined":
            case "function":
            case "symbol":
            case "boolean":
              node.removeAttribute(name);
              return;
          }
          node.setAttribute(name, "" + value);
        }
      }
      function setValueForNamespacedAttribute(node, namespace, name, value) {
        if (null === value) node.removeAttribute(name);
        else {
          switch (typeof value) {
            case "undefined":
            case "function":
            case "symbol":
            case "boolean":
              node.removeAttribute(name);
              return;
          }
          node.setAttributeNS(namespace, name, "" + value);
        }
      }
      function getToStringValue(value) {
        switch (typeof value) {
          case "bigint":
          case "boolean":
          case "number":
          case "string":
          case "undefined":
            return value;
          case "object":
            return value;
          default:
            return "";
        }
      }
      function isCheckable(elem) {
        var type2 = elem.type;
        return (elem = elem.nodeName) && "input" === elem.toLowerCase() && ("checkbox" === type2 || "radio" === type2);
      }
      function trackValueOnNode(node) {
        var valueField = isCheckable(node) ? "checked" : "value", descriptor = Object.getOwnPropertyDescriptor(
          node.constructor.prototype,
          valueField
        ), currentValue = "" + node[valueField];
        if (!node.hasOwnProperty(valueField) && "undefined" !== typeof descriptor && "function" === typeof descriptor.get && "function" === typeof descriptor.set) {
          var get = descriptor.get, set = descriptor.set;
          Object.defineProperty(node, valueField, {
            configurable: true,
            get: function() {
              return get.call(this);
            },
            set: function(value) {
              currentValue = "" + value;
              set.call(this, value);
            }
          });
          Object.defineProperty(node, valueField, {
            enumerable: descriptor.enumerable
          });
          return {
            getValue: function() {
              return currentValue;
            },
            setValue: function(value) {
              currentValue = "" + value;
            },
            stopTracking: function() {
              node._valueTracker = null;
              delete node[valueField];
            }
          };
        }
      }
      function track(node) {
        node._valueTracker || (node._valueTracker = trackValueOnNode(node));
      }
      function updateValueIfChanged(node) {
        if (!node) return false;
        var tracker = node._valueTracker;
        if (!tracker) return true;
        var lastValue = tracker.getValue();
        var value = "";
        node && (value = isCheckable(node) ? node.checked ? "true" : "false" : node.value);
        node = value;
        return node !== lastValue ? (tracker.setValue(node), true) : false;
      }
      function getActiveElement(doc2) {
        doc2 = doc2 || ("undefined" !== typeof document ? document : void 0);
        if ("undefined" === typeof doc2) return null;
        try {
          return doc2.activeElement || doc2.body;
        } catch (e) {
          return doc2.body;
        }
      }
      var escapeSelectorAttributeValueInsideDoubleQuotesRegex = /[\n"\\]/g;
      function escapeSelectorAttributeValueInsideDoubleQuotes(value) {
        return value.replace(
          escapeSelectorAttributeValueInsideDoubleQuotesRegex,
          function(ch) {
            return "\\" + ch.charCodeAt(0).toString(16) + " ";
          }
        );
      }
      function updateInput(element, value, defaultValue, lastDefaultValue, checked, defaultChecked, type2, name) {
        element.name = "";
        null != type2 && "function" !== typeof type2 && "symbol" !== typeof type2 && "boolean" !== typeof type2 ? element.type = type2 : element.removeAttribute("type");
        if (null != value)
          if ("number" === type2) {
            if (0 === value && "" === element.value || element.value != value)
              element.value = "" + getToStringValue(value);
          } else
            element.value !== "" + getToStringValue(value) && (element.value = "" + getToStringValue(value));
        else
          "submit" !== type2 && "reset" !== type2 || element.removeAttribute("value");
        null != value ? setDefaultValue(element, type2, getToStringValue(value)) : null != defaultValue ? setDefaultValue(element, type2, getToStringValue(defaultValue)) : null != lastDefaultValue && element.removeAttribute("value");
        null == checked && null != defaultChecked && (element.defaultChecked = !!defaultChecked);
        null != checked && (element.checked = checked && "function" !== typeof checked && "symbol" !== typeof checked);
        null != name && "function" !== typeof name && "symbol" !== typeof name && "boolean" !== typeof name ? element.name = "" + getToStringValue(name) : element.removeAttribute("name");
      }
      function initInput(element, value, defaultValue, checked, defaultChecked, type2, name, isHydrating2) {
        null != type2 && "function" !== typeof type2 && "symbol" !== typeof type2 && "boolean" !== typeof type2 && (element.type = type2);
        if (null != value || null != defaultValue) {
          if (!("submit" !== type2 && "reset" !== type2 || void 0 !== value && null !== value))
            return;
          defaultValue = null != defaultValue ? "" + getToStringValue(defaultValue) : "";
          value = null != value ? "" + getToStringValue(value) : defaultValue;
          isHydrating2 || value === element.value || (element.value = value);
          element.defaultValue = value;
        }
        checked = null != checked ? checked : defaultChecked;
        checked = "function" !== typeof checked && "symbol" !== typeof checked && !!checked;
        element.checked = isHydrating2 ? element.checked : !!checked;
        element.defaultChecked = !!checked;
        null != name && "function" !== typeof name && "symbol" !== typeof name && "boolean" !== typeof name && (element.name = name);
      }
      function setDefaultValue(node, type2, value) {
        "number" === type2 && getActiveElement(node.ownerDocument) === node || node.defaultValue === "" + value || (node.defaultValue = "" + value);
      }
      function updateOptions(node, multiple, propValue, setDefaultSelected) {
        node = node.options;
        if (multiple) {
          multiple = {};
          for (var i = 0; i < propValue.length; i++)
            multiple["$" + propValue[i]] = true;
          for (propValue = 0; propValue < node.length; propValue++)
            i = multiple.hasOwnProperty("$" + node[propValue].value), node[propValue].selected !== i && (node[propValue].selected = i), i && setDefaultSelected && (node[propValue].defaultSelected = true);
        } else {
          propValue = "" + getToStringValue(propValue);
          multiple = null;
          for (i = 0; i < node.length; i++) {
            if (node[i].value === propValue) {
              node[i].selected = true;
              setDefaultSelected && (node[i].defaultSelected = true);
              return;
            }
            null !== multiple || node[i].disabled || (multiple = node[i]);
          }
          null !== multiple && (multiple.selected = true);
        }
      }
      function updateTextarea(element, value, defaultValue) {
        if (null != value && (value = "" + getToStringValue(value), value !== element.value && (element.value = value), null == defaultValue)) {
          element.defaultValue !== value && (element.defaultValue = value);
          return;
        }
        element.defaultValue = null != defaultValue ? "" + getToStringValue(defaultValue) : "";
      }
      function initTextarea(element, value, defaultValue, children) {
        if (null == value) {
          if (null != children) {
            if (null != defaultValue) throw Error(formatProdErrorMessage(92));
            if (isArrayImpl(children)) {
              if (1 < children.length) throw Error(formatProdErrorMessage(93));
              children = children[0];
            }
            defaultValue = children;
          }
          null == defaultValue && (defaultValue = "");
          value = defaultValue;
        }
        defaultValue = getToStringValue(value);
        element.defaultValue = defaultValue;
        children = element.textContent;
        children === defaultValue && "" !== children && null !== children && (element.value = children);
      }
      function setTextContent(node, text) {
        if (text) {
          var firstChild = node.firstChild;
          if (firstChild && firstChild === node.lastChild && 3 === firstChild.nodeType) {
            firstChild.nodeValue = text;
            return;
          }
        }
        node.textContent = text;
      }
      var unitlessNumbers = new Set(
        "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
          " "
        )
      );
      function setValueForStyle(style2, styleName, value) {
        var isCustomProperty = 0 === styleName.indexOf("--");
        null == value || "boolean" === typeof value || "" === value ? isCustomProperty ? style2.setProperty(styleName, "") : "float" === styleName ? style2.cssFloat = "" : style2[styleName] = "" : isCustomProperty ? style2.setProperty(styleName, value) : "number" !== typeof value || 0 === value || unitlessNumbers.has(styleName) ? "float" === styleName ? style2.cssFloat = value : style2[styleName] = ("" + value).trim() : style2[styleName] = value + "px";
      }
      function setValueForStyles(node, styles, prevStyles) {
        if (null != styles && "object" !== typeof styles)
          throw Error(formatProdErrorMessage(62));
        node = node.style;
        if (null != prevStyles) {
          for (var styleName in prevStyles)
            !prevStyles.hasOwnProperty(styleName) || null != styles && styles.hasOwnProperty(styleName) || (0 === styleName.indexOf("--") ? node.setProperty(styleName, "") : "float" === styleName ? node.cssFloat = "" : node[styleName] = "");
          for (var styleName$16 in styles)
            styleName = styles[styleName$16], styles.hasOwnProperty(styleName$16) && prevStyles[styleName$16] !== styleName && setValueForStyle(node, styleName$16, styleName);
        } else
          for (var styleName$17 in styles)
            styles.hasOwnProperty(styleName$17) && setValueForStyle(node, styleName$17, styles[styleName$17]);
      }
      function isCustomElement(tagName) {
        if (-1 === tagName.indexOf("-")) return false;
        switch (tagName) {
          case "annotation-xml":
          case "color-profile":
          case "font-face":
          case "font-face-src":
          case "font-face-uri":
          case "font-face-format":
          case "font-face-name":
          case "missing-glyph":
            return false;
          default:
            return true;
        }
      }
      var aliases = /* @__PURE__ */ new Map([
        ["acceptCharset", "accept-charset"],
        ["htmlFor", "for"],
        ["httpEquiv", "http-equiv"],
        ["crossOrigin", "crossorigin"],
        ["accentHeight", "accent-height"],
        ["alignmentBaseline", "alignment-baseline"],
        ["arabicForm", "arabic-form"],
        ["baselineShift", "baseline-shift"],
        ["capHeight", "cap-height"],
        ["clipPath", "clip-path"],
        ["clipRule", "clip-rule"],
        ["colorInterpolation", "color-interpolation"],
        ["colorInterpolationFilters", "color-interpolation-filters"],
        ["colorProfile", "color-profile"],
        ["colorRendering", "color-rendering"],
        ["dominantBaseline", "dominant-baseline"],
        ["enableBackground", "enable-background"],
        ["fillOpacity", "fill-opacity"],
        ["fillRule", "fill-rule"],
        ["floodColor", "flood-color"],
        ["floodOpacity", "flood-opacity"],
        ["fontFamily", "font-family"],
        ["fontSize", "font-size"],
        ["fontSizeAdjust", "font-size-adjust"],
        ["fontStretch", "font-stretch"],
        ["fontStyle", "font-style"],
        ["fontVariant", "font-variant"],
        ["fontWeight", "font-weight"],
        ["glyphName", "glyph-name"],
        ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
        ["glyphOrientationVertical", "glyph-orientation-vertical"],
        ["horizAdvX", "horiz-adv-x"],
        ["horizOriginX", "horiz-origin-x"],
        ["imageRendering", "image-rendering"],
        ["letterSpacing", "letter-spacing"],
        ["lightingColor", "lighting-color"],
        ["markerEnd", "marker-end"],
        ["markerMid", "marker-mid"],
        ["markerStart", "marker-start"],
        ["overlinePosition", "overline-position"],
        ["overlineThickness", "overline-thickness"],
        ["paintOrder", "paint-order"],
        ["panose-1", "panose-1"],
        ["pointerEvents", "pointer-events"],
        ["renderingIntent", "rendering-intent"],
        ["shapeRendering", "shape-rendering"],
        ["stopColor", "stop-color"],
        ["stopOpacity", "stop-opacity"],
        ["strikethroughPosition", "strikethrough-position"],
        ["strikethroughThickness", "strikethrough-thickness"],
        ["strokeDasharray", "stroke-dasharray"],
        ["strokeDashoffset", "stroke-dashoffset"],
        ["strokeLinecap", "stroke-linecap"],
        ["strokeLinejoin", "stroke-linejoin"],
        ["strokeMiterlimit", "stroke-miterlimit"],
        ["strokeOpacity", "stroke-opacity"],
        ["strokeWidth", "stroke-width"],
        ["textAnchor", "text-anchor"],
        ["textDecoration", "text-decoration"],
        ["textRendering", "text-rendering"],
        ["transformOrigin", "transform-origin"],
        ["underlinePosition", "underline-position"],
        ["underlineThickness", "underline-thickness"],
        ["unicodeBidi", "unicode-bidi"],
        ["unicodeRange", "unicode-range"],
        ["unitsPerEm", "units-per-em"],
        ["vAlphabetic", "v-alphabetic"],
        ["vHanging", "v-hanging"],
        ["vIdeographic", "v-ideographic"],
        ["vMathematical", "v-mathematical"],
        ["vectorEffect", "vector-effect"],
        ["vertAdvY", "vert-adv-y"],
        ["vertOriginX", "vert-origin-x"],
        ["vertOriginY", "vert-origin-y"],
        ["wordSpacing", "word-spacing"],
        ["writingMode", "writing-mode"],
        ["xmlnsXlink", "xmlns:xlink"],
        ["xHeight", "x-height"]
      ]);
      var isJavaScriptProtocol = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
      function sanitizeURL(url) {
        return isJavaScriptProtocol.test("" + url) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : url;
      }
      var currentReplayingEvent = null;
      function getEventTarget(nativeEvent) {
        nativeEvent = nativeEvent.target || nativeEvent.srcElement || window;
        nativeEvent.correspondingUseElement && (nativeEvent = nativeEvent.correspondingUseElement);
        return 3 === nativeEvent.nodeType ? nativeEvent.parentNode : nativeEvent;
      }
      var restoreTarget = null;
      var restoreQueue = null;
      function restoreStateOfTarget(target) {
        var internalInstance = getInstanceFromNode(target);
        if (internalInstance && (target = internalInstance.stateNode)) {
          var props = target[internalPropsKey] || null;
          a: switch (target = internalInstance.stateNode, internalInstance.type) {
            case "input":
              updateInput(
                target,
                props.value,
                props.defaultValue,
                props.defaultValue,
                props.checked,
                props.defaultChecked,
                props.type,
                props.name
              );
              internalInstance = props.name;
              if ("radio" === props.type && null != internalInstance) {
                for (props = target; props.parentNode; ) props = props.parentNode;
                props = props.querySelectorAll(
                  'input[name="' + escapeSelectorAttributeValueInsideDoubleQuotes(
                    "" + internalInstance
                  ) + '"][type="radio"]'
                );
                for (internalInstance = 0; internalInstance < props.length; internalInstance++) {
                  var otherNode = props[internalInstance];
                  if (otherNode !== target && otherNode.form === target.form) {
                    var otherProps = otherNode[internalPropsKey] || null;
                    if (!otherProps) throw Error(formatProdErrorMessage(90));
                    updateInput(
                      otherNode,
                      otherProps.value,
                      otherProps.defaultValue,
                      otherProps.defaultValue,
                      otherProps.checked,
                      otherProps.defaultChecked,
                      otherProps.type,
                      otherProps.name
                    );
                  }
                }
                for (internalInstance = 0; internalInstance < props.length; internalInstance++)
                  otherNode = props[internalInstance], otherNode.form === target.form && updateValueIfChanged(otherNode);
              }
              break a;
            case "textarea":
              updateTextarea(target, props.value, props.defaultValue);
              break a;
            case "select":
              internalInstance = props.value, null != internalInstance && updateOptions(target, !!props.multiple, internalInstance, false);
          }
        }
      }
      var isInsideEventHandler = false;
      function batchedUpdates$1(fn, a, b) {
        if (isInsideEventHandler) return fn(a, b);
        isInsideEventHandler = true;
        try {
          var JSCompiler_inline_result = fn(a);
          return JSCompiler_inline_result;
        } finally {
          if (isInsideEventHandler = false, null !== restoreTarget || null !== restoreQueue) {
            if (flushSyncWork$1(), restoreTarget && (a = restoreTarget, fn = restoreQueue, restoreQueue = restoreTarget = null, restoreStateOfTarget(a), fn))
              for (a = 0; a < fn.length; a++) restoreStateOfTarget(fn[a]);
          }
        }
      }
      function getListener(inst, registrationName) {
        var stateNode = inst.stateNode;
        if (null === stateNode) return null;
        var props = stateNode[internalPropsKey] || null;
        if (null === props) return null;
        stateNode = props[registrationName];
        a: switch (registrationName) {
          case "onClick":
          case "onClickCapture":
          case "onDoubleClick":
          case "onDoubleClickCapture":
          case "onMouseDown":
          case "onMouseDownCapture":
          case "onMouseMove":
          case "onMouseMoveCapture":
          case "onMouseUp":
          case "onMouseUpCapture":
          case "onMouseEnter":
            (props = !props.disabled) || (inst = inst.type, props = !("button" === inst || "input" === inst || "select" === inst || "textarea" === inst));
            inst = !props;
            break a;
          default:
            inst = false;
        }
        if (inst) return null;
        if (stateNode && "function" !== typeof stateNode)
          throw Error(
            formatProdErrorMessage(231, registrationName, typeof stateNode)
          );
        return stateNode;
      }
      var passiveBrowserEventsSupported = false;
      if (canUseDOM)
        try {
          options = {};
          Object.defineProperty(options, "passive", {
            get: function() {
              passiveBrowserEventsSupported = true;
            }
          });
          window.addEventListener("test", options, options);
          window.removeEventListener("test", options, options);
        } catch (e) {
          passiveBrowserEventsSupported = false;
        }
      var options;
      var root = null;
      var startText = null;
      var fallbackText = null;
      function getData() {
        if (fallbackText) return fallbackText;
        var start, startValue = startText, startLength = startValue.length, end, endValue = "value" in root ? root.value : root.textContent, endLength = endValue.length;
        for (start = 0; start < startLength && startValue[start] === endValue[start]; start++) ;
        var minEnd = startLength - start;
        for (end = 1; end <= minEnd && startValue[startLength - end] === endValue[endLength - end]; end++) ;
        return fallbackText = endValue.slice(start, 1 < end ? 1 - end : void 0);
      }
      function getEventCharCode(nativeEvent) {
        var keyCode = nativeEvent.keyCode;
        "charCode" in nativeEvent ? (nativeEvent = nativeEvent.charCode, 0 === nativeEvent && 13 === keyCode && (nativeEvent = 13)) : nativeEvent = keyCode;
        10 === nativeEvent && (nativeEvent = 13);
        return 32 <= nativeEvent || 13 === nativeEvent ? nativeEvent : 0;
      }
      function functionThatReturnsTrue() {
        return true;
      }
      function functionThatReturnsFalse() {
        return false;
      }
      function createSyntheticEvent(Interface) {
        function SyntheticBaseEvent(reactName, reactEventType, targetInst, nativeEvent, nativeEventTarget) {
          this._reactName = reactName;
          this._targetInst = targetInst;
          this.type = reactEventType;
          this.nativeEvent = nativeEvent;
          this.target = nativeEventTarget;
          this.currentTarget = null;
          for (var propName in Interface)
            Interface.hasOwnProperty(propName) && (reactName = Interface[propName], this[propName] = reactName ? reactName(nativeEvent) : nativeEvent[propName]);
          this.isDefaultPrevented = (null != nativeEvent.defaultPrevented ? nativeEvent.defaultPrevented : false === nativeEvent.returnValue) ? functionThatReturnsTrue : functionThatReturnsFalse;
          this.isPropagationStopped = functionThatReturnsFalse;
          return this;
        }
        assign(SyntheticBaseEvent.prototype, {
          preventDefault: function() {
            this.defaultPrevented = true;
            var event = this.nativeEvent;
            event && (event.preventDefault ? event.preventDefault() : "unknown" !== typeof event.returnValue && (event.returnValue = false), this.isDefaultPrevented = functionThatReturnsTrue);
          },
          stopPropagation: function() {
            var event = this.nativeEvent;
            event && (event.stopPropagation ? event.stopPropagation() : "unknown" !== typeof event.cancelBubble && (event.cancelBubble = true), this.isPropagationStopped = functionThatReturnsTrue);
          },
          persist: function() {
          },
          isPersistent: functionThatReturnsTrue
        });
        return SyntheticBaseEvent;
      }
      var EventInterface = {
        eventPhase: 0,
        bubbles: 0,
        cancelable: 0,
        timeStamp: function(event) {
          return event.timeStamp || Date.now();
        },
        defaultPrevented: 0,
        isTrusted: 0
      };
      var SyntheticEvent = createSyntheticEvent(EventInterface);
      var UIEventInterface = assign({}, EventInterface, { view: 0, detail: 0 });
      var SyntheticUIEvent = createSyntheticEvent(UIEventInterface);
      var lastMovementX;
      var lastMovementY;
      var lastMouseEvent;
      var MouseEventInterface = assign({}, UIEventInterface, {
        screenX: 0,
        screenY: 0,
        clientX: 0,
        clientY: 0,
        pageX: 0,
        pageY: 0,
        ctrlKey: 0,
        shiftKey: 0,
        altKey: 0,
        metaKey: 0,
        getModifierState: getEventModifierState,
        button: 0,
        buttons: 0,
        relatedTarget: function(event) {
          return void 0 === event.relatedTarget ? event.fromElement === event.srcElement ? event.toElement : event.fromElement : event.relatedTarget;
        },
        movementX: function(event) {
          if ("movementX" in event) return event.movementX;
          event !== lastMouseEvent && (lastMouseEvent && "mousemove" === event.type ? (lastMovementX = event.screenX - lastMouseEvent.screenX, lastMovementY = event.screenY - lastMouseEvent.screenY) : lastMovementY = lastMovementX = 0, lastMouseEvent = event);
          return lastMovementX;
        },
        movementY: function(event) {
          return "movementY" in event ? event.movementY : lastMovementY;
        }
      });
      var SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface);
      var DragEventInterface = assign({}, MouseEventInterface, { dataTransfer: 0 });
      var SyntheticDragEvent = createSyntheticEvent(DragEventInterface);
      var FocusEventInterface = assign({}, UIEventInterface, { relatedTarget: 0 });
      var SyntheticFocusEvent = createSyntheticEvent(FocusEventInterface);
      var AnimationEventInterface = assign({}, EventInterface, {
        animationName: 0,
        elapsedTime: 0,
        pseudoElement: 0
      });
      var SyntheticAnimationEvent = createSyntheticEvent(AnimationEventInterface);
      var ClipboardEventInterface = assign({}, EventInterface, {
        clipboardData: function(event) {
          return "clipboardData" in event ? event.clipboardData : window.clipboardData;
        }
      });
      var SyntheticClipboardEvent = createSyntheticEvent(ClipboardEventInterface);
      var CompositionEventInterface = assign({}, EventInterface, { data: 0 });
      var SyntheticCompositionEvent = createSyntheticEvent(CompositionEventInterface);
      var normalizeKey = {
        Esc: "Escape",
        Spacebar: " ",
        Left: "ArrowLeft",
        Up: "ArrowUp",
        Right: "ArrowRight",
        Down: "ArrowDown",
        Del: "Delete",
        Win: "OS",
        Menu: "ContextMenu",
        Apps: "ContextMenu",
        Scroll: "ScrollLock",
        MozPrintableKey: "Unidentified"
      };
      var translateToKey = {
        8: "Backspace",
        9: "Tab",
        12: "Clear",
        13: "Enter",
        16: "Shift",
        17: "Control",
        18: "Alt",
        19: "Pause",
        20: "CapsLock",
        27: "Escape",
        32: " ",
        33: "PageUp",
        34: "PageDown",
        35: "End",
        36: "Home",
        37: "ArrowLeft",
        38: "ArrowUp",
        39: "ArrowRight",
        40: "ArrowDown",
        45: "Insert",
        46: "Delete",
        112: "F1",
        113: "F2",
        114: "F3",
        115: "F4",
        116: "F5",
        117: "F6",
        118: "F7",
        119: "F8",
        120: "F9",
        121: "F10",
        122: "F11",
        123: "F12",
        144: "NumLock",
        145: "ScrollLock",
        224: "Meta"
      };
      var modifierKeyToProp = {
        Alt: "altKey",
        Control: "ctrlKey",
        Meta: "metaKey",
        Shift: "shiftKey"
      };
      function modifierStateGetter(keyArg) {
        var nativeEvent = this.nativeEvent;
        return nativeEvent.getModifierState ? nativeEvent.getModifierState(keyArg) : (keyArg = modifierKeyToProp[keyArg]) ? !!nativeEvent[keyArg] : false;
      }
      function getEventModifierState() {
        return modifierStateGetter;
      }
      var KeyboardEventInterface = assign({}, UIEventInterface, {
        key: function(nativeEvent) {
          if (nativeEvent.key) {
            var key = normalizeKey[nativeEvent.key] || nativeEvent.key;
            if ("Unidentified" !== key) return key;
          }
          return "keypress" === nativeEvent.type ? (nativeEvent = getEventCharCode(nativeEvent), 13 === nativeEvent ? "Enter" : String.fromCharCode(nativeEvent)) : "keydown" === nativeEvent.type || "keyup" === nativeEvent.type ? translateToKey[nativeEvent.keyCode] || "Unidentified" : "";
        },
        code: 0,
        location: 0,
        ctrlKey: 0,
        shiftKey: 0,
        altKey: 0,
        metaKey: 0,
        repeat: 0,
        locale: 0,
        getModifierState: getEventModifierState,
        charCode: function(event) {
          return "keypress" === event.type ? getEventCharCode(event) : 0;
        },
        keyCode: function(event) {
          return "keydown" === event.type || "keyup" === event.type ? event.keyCode : 0;
        },
        which: function(event) {
          return "keypress" === event.type ? getEventCharCode(event) : "keydown" === event.type || "keyup" === event.type ? event.keyCode : 0;
        }
      });
      var SyntheticKeyboardEvent = createSyntheticEvent(KeyboardEventInterface);
      var PointerEventInterface = assign({}, MouseEventInterface, {
        pointerId: 0,
        width: 0,
        height: 0,
        pressure: 0,
        tangentialPressure: 0,
        tiltX: 0,
        tiltY: 0,
        twist: 0,
        pointerType: 0,
        isPrimary: 0
      });
      var SyntheticPointerEvent = createSyntheticEvent(PointerEventInterface);
      var TouchEventInterface = assign({}, UIEventInterface, {
        touches: 0,
        targetTouches: 0,
        changedTouches: 0,
        altKey: 0,
        metaKey: 0,
        ctrlKey: 0,
        shiftKey: 0,
        getModifierState: getEventModifierState
      });
      var SyntheticTouchEvent = createSyntheticEvent(TouchEventInterface);
      var TransitionEventInterface = assign({}, EventInterface, {
        propertyName: 0,
        elapsedTime: 0,
        pseudoElement: 0
      });
      var SyntheticTransitionEvent = createSyntheticEvent(TransitionEventInterface);
      var WheelEventInterface = assign({}, MouseEventInterface, {
        deltaX: function(event) {
          return "deltaX" in event ? event.deltaX : "wheelDeltaX" in event ? -event.wheelDeltaX : 0;
        },
        deltaY: function(event) {
          return "deltaY" in event ? event.deltaY : "wheelDeltaY" in event ? -event.wheelDeltaY : "wheelDelta" in event ? -event.wheelDelta : 0;
        },
        deltaZ: 0,
        deltaMode: 0
      });
      var SyntheticWheelEvent = createSyntheticEvent(WheelEventInterface);
      var ToggleEventInterface = assign({}, EventInterface, {
        newState: 0,
        oldState: 0
      });
      var SyntheticToggleEvent = createSyntheticEvent(ToggleEventInterface);
      var END_KEYCODES = [9, 13, 27, 32];
      var canUseCompositionEvent = canUseDOM && "CompositionEvent" in window;
      var documentMode = null;
      canUseDOM && "documentMode" in document && (documentMode = document.documentMode);
      var canUseTextInputEvent = canUseDOM && "TextEvent" in window && !documentMode;
      var useFallbackCompositionData = canUseDOM && (!canUseCompositionEvent || documentMode && 8 < documentMode && 11 >= documentMode);
      var SPACEBAR_CHAR = String.fromCharCode(32);
      var hasSpaceKeypress = false;
      function isFallbackCompositionEnd(domEventName, nativeEvent) {
        switch (domEventName) {
          case "keyup":
            return -1 !== END_KEYCODES.indexOf(nativeEvent.keyCode);
          case "keydown":
            return 229 !== nativeEvent.keyCode;
          case "keypress":
          case "mousedown":
          case "focusout":
            return true;
          default:
            return false;
        }
      }
      function getDataFromCustomEvent(nativeEvent) {
        nativeEvent = nativeEvent.detail;
        return "object" === typeof nativeEvent && "data" in nativeEvent ? nativeEvent.data : null;
      }
      var isComposing = false;
      function getNativeBeforeInputChars(domEventName, nativeEvent) {
        switch (domEventName) {
          case "compositionend":
            return getDataFromCustomEvent(nativeEvent);
          case "keypress":
            if (32 !== nativeEvent.which) return null;
            hasSpaceKeypress = true;
            return SPACEBAR_CHAR;
          case "textInput":
            return domEventName = nativeEvent.data, domEventName === SPACEBAR_CHAR && hasSpaceKeypress ? null : domEventName;
          default:
            return null;
        }
      }
      function getFallbackBeforeInputChars(domEventName, nativeEvent) {
        if (isComposing)
          return "compositionend" === domEventName || !canUseCompositionEvent && isFallbackCompositionEnd(domEventName, nativeEvent) ? (domEventName = getData(), fallbackText = startText = root = null, isComposing = false, domEventName) : null;
        switch (domEventName) {
          case "paste":
            return null;
          case "keypress":
            if (!(nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) || nativeEvent.ctrlKey && nativeEvent.altKey) {
              if (nativeEvent.char && 1 < nativeEvent.char.length)
                return nativeEvent.char;
              if (nativeEvent.which) return String.fromCharCode(nativeEvent.which);
            }
            return null;
          case "compositionend":
            return useFallbackCompositionData && "ko" !== nativeEvent.locale ? null : nativeEvent.data;
          default:
            return null;
        }
      }
      var supportedInputTypes = {
        color: true,
        date: true,
        datetime: true,
        "datetime-local": true,
        email: true,
        month: true,
        number: true,
        password: true,
        range: true,
        search: true,
        tel: true,
        text: true,
        time: true,
        url: true,
        week: true
      };
      function isTextInputElement(elem) {
        var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
        return "input" === nodeName ? !!supportedInputTypes[elem.type] : "textarea" === nodeName ? true : false;
      }
      function createAndAccumulateChangeEvent(dispatchQueue, inst, nativeEvent, target) {
        restoreTarget ? restoreQueue ? restoreQueue.push(target) : restoreQueue = [target] : restoreTarget = target;
        inst = accumulateTwoPhaseListeners(inst, "onChange");
        0 < inst.length && (nativeEvent = new SyntheticEvent(
          "onChange",
          "change",
          null,
          nativeEvent,
          target
        ), dispatchQueue.push({ event: nativeEvent, listeners: inst }));
      }
      var activeElement$1 = null;
      var activeElementInst$1 = null;
      function runEventInBatch(dispatchQueue) {
        processDispatchQueue(dispatchQueue, 0);
      }
      function getInstIfValueChanged(targetInst) {
        var targetNode = getNodeFromInstance(targetInst);
        if (updateValueIfChanged(targetNode)) return targetInst;
      }
      function getTargetInstForChangeEvent(domEventName, targetInst) {
        if ("change" === domEventName) return targetInst;
      }
      var isInputEventSupported = false;
      if (canUseDOM) {
        if (canUseDOM) {
          isSupported$jscomp$inline_418 = "oninput" in document;
          if (!isSupported$jscomp$inline_418) {
            element$jscomp$inline_419 = document.createElement("div");
            element$jscomp$inline_419.setAttribute("oninput", "return;");
            isSupported$jscomp$inline_418 = "function" === typeof element$jscomp$inline_419.oninput;
          }
          JSCompiler_inline_result$jscomp$283 = isSupported$jscomp$inline_418;
        } else JSCompiler_inline_result$jscomp$283 = false;
        isInputEventSupported = JSCompiler_inline_result$jscomp$283 && (!document.documentMode || 9 < document.documentMode);
      }
      var JSCompiler_inline_result$jscomp$283;
      var isSupported$jscomp$inline_418;
      var element$jscomp$inline_419;
      function stopWatchingForValueChange() {
        activeElement$1 && (activeElement$1.detachEvent("onpropertychange", handlePropertyChange), activeElementInst$1 = activeElement$1 = null);
      }
      function handlePropertyChange(nativeEvent) {
        if ("value" === nativeEvent.propertyName && getInstIfValueChanged(activeElementInst$1)) {
          var dispatchQueue = [];
          createAndAccumulateChangeEvent(
            dispatchQueue,
            activeElementInst$1,
            nativeEvent,
            getEventTarget(nativeEvent)
          );
          batchedUpdates$1(runEventInBatch, dispatchQueue);
        }
      }
      function handleEventsForInputEventPolyfill(domEventName, target, targetInst) {
        "focusin" === domEventName ? (stopWatchingForValueChange(), activeElement$1 = target, activeElementInst$1 = targetInst, activeElement$1.attachEvent("onpropertychange", handlePropertyChange)) : "focusout" === domEventName && stopWatchingForValueChange();
      }
      function getTargetInstForInputEventPolyfill(domEventName) {
        if ("selectionchange" === domEventName || "keyup" === domEventName || "keydown" === domEventName)
          return getInstIfValueChanged(activeElementInst$1);
      }
      function getTargetInstForClickEvent(domEventName, targetInst) {
        if ("click" === domEventName) return getInstIfValueChanged(targetInst);
      }
      function getTargetInstForInputOrChangeEvent(domEventName, targetInst) {
        if ("input" === domEventName || "change" === domEventName)
          return getInstIfValueChanged(targetInst);
      }
      function is(x, y) {
        return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
      }
      var objectIs = "function" === typeof Object.is ? Object.is : is;
      function shallowEqual(objA, objB) {
        if (objectIs(objA, objB)) return true;
        if ("object" !== typeof objA || null === objA || "object" !== typeof objB || null === objB)
          return false;
        var keysA = Object.keys(objA), keysB = Object.keys(objB);
        if (keysA.length !== keysB.length) return false;
        for (keysB = 0; keysB < keysA.length; keysB++) {
          var currentKey = keysA[keysB];
          if (!hasOwnProperty.call(objB, currentKey) || !objectIs(objA[currentKey], objB[currentKey]))
            return false;
        }
        return true;
      }
      function getLeafNode(node) {
        for (; node && node.firstChild; ) node = node.firstChild;
        return node;
      }
      function getNodeForCharacterOffset(root2, offset) {
        var node = getLeafNode(root2);
        root2 = 0;
        for (var nodeEnd; node; ) {
          if (3 === node.nodeType) {
            nodeEnd = root2 + node.textContent.length;
            if (root2 <= offset && nodeEnd >= offset)
              return { node, offset: offset - root2 };
            root2 = nodeEnd;
          }
          a: {
            for (; node; ) {
              if (node.nextSibling) {
                node = node.nextSibling;
                break a;
              }
              node = node.parentNode;
            }
            node = void 0;
          }
          node = getLeafNode(node);
        }
      }
      function containsNode(outerNode, innerNode) {
        return outerNode && innerNode ? outerNode === innerNode ? true : outerNode && 3 === outerNode.nodeType ? false : innerNode && 3 === innerNode.nodeType ? containsNode(outerNode, innerNode.parentNode) : "contains" in outerNode ? outerNode.contains(innerNode) : outerNode.compareDocumentPosition ? !!(outerNode.compareDocumentPosition(innerNode) & 16) : false : false;
      }
      function getActiveElementDeep(containerInfo) {
        containerInfo = null != containerInfo && null != containerInfo.ownerDocument && null != containerInfo.ownerDocument.defaultView ? containerInfo.ownerDocument.defaultView : window;
        for (var element = getActiveElement(containerInfo.document); element instanceof containerInfo.HTMLIFrameElement; ) {
          try {
            var JSCompiler_inline_result = "string" === typeof element.contentWindow.location.href;
          } catch (err) {
            JSCompiler_inline_result = false;
          }
          if (JSCompiler_inline_result) containerInfo = element.contentWindow;
          else break;
          element = getActiveElement(containerInfo.document);
        }
        return element;
      }
      function hasSelectionCapabilities(elem) {
        var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
        return nodeName && ("input" === nodeName && ("text" === elem.type || "search" === elem.type || "tel" === elem.type || "url" === elem.type || "password" === elem.type) || "textarea" === nodeName || "true" === elem.contentEditable);
      }
      function restoreSelection(priorSelectionInformation, containerInfo) {
        var curFocusedElem = getActiveElementDeep(containerInfo);
        containerInfo = priorSelectionInformation.focusedElem;
        var priorSelectionRange = priorSelectionInformation.selectionRange;
        if (curFocusedElem !== containerInfo && containerInfo && containerInfo.ownerDocument && containsNode(containerInfo.ownerDocument.documentElement, containerInfo)) {
          if (null !== priorSelectionRange && hasSelectionCapabilities(containerInfo)) {
            if (priorSelectionInformation = priorSelectionRange.start, curFocusedElem = priorSelectionRange.end, void 0 === curFocusedElem && (curFocusedElem = priorSelectionInformation), "selectionStart" in containerInfo)
              containerInfo.selectionStart = priorSelectionInformation, containerInfo.selectionEnd = Math.min(
                curFocusedElem,
                containerInfo.value.length
              );
            else if (curFocusedElem = (priorSelectionInformation = containerInfo.ownerDocument || document) && priorSelectionInformation.defaultView || window, curFocusedElem.getSelection) {
              curFocusedElem = curFocusedElem.getSelection();
              var length = containerInfo.textContent.length, start = Math.min(priorSelectionRange.start, length);
              priorSelectionRange = void 0 === priorSelectionRange.end ? start : Math.min(priorSelectionRange.end, length);
              !curFocusedElem.extend && start > priorSelectionRange && (length = priorSelectionRange, priorSelectionRange = start, start = length);
              length = getNodeForCharacterOffset(containerInfo, start);
              var endMarker = getNodeForCharacterOffset(
                containerInfo,
                priorSelectionRange
              );
              length && endMarker && (1 !== curFocusedElem.rangeCount || curFocusedElem.anchorNode !== length.node || curFocusedElem.anchorOffset !== length.offset || curFocusedElem.focusNode !== endMarker.node || curFocusedElem.focusOffset !== endMarker.offset) && (priorSelectionInformation = priorSelectionInformation.createRange(), priorSelectionInformation.setStart(length.node, length.offset), curFocusedElem.removeAllRanges(), start > priorSelectionRange ? (curFocusedElem.addRange(priorSelectionInformation), curFocusedElem.extend(endMarker.node, endMarker.offset)) : (priorSelectionInformation.setEnd(
                endMarker.node,
                endMarker.offset
              ), curFocusedElem.addRange(priorSelectionInformation)));
            }
          }
          priorSelectionInformation = [];
          for (curFocusedElem = containerInfo; curFocusedElem = curFocusedElem.parentNode; )
            1 === curFocusedElem.nodeType && priorSelectionInformation.push({
              element: curFocusedElem,
              left: curFocusedElem.scrollLeft,
              top: curFocusedElem.scrollTop
            });
          "function" === typeof containerInfo.focus && containerInfo.focus();
          for (containerInfo = 0; containerInfo < priorSelectionInformation.length; containerInfo++)
            curFocusedElem = priorSelectionInformation[containerInfo], curFocusedElem.element.scrollLeft = curFocusedElem.left, curFocusedElem.element.scrollTop = curFocusedElem.top;
        }
      }
      var skipSelectionChangeEvent = canUseDOM && "documentMode" in document && 11 >= document.documentMode;
      var activeElement = null;
      var activeElementInst = null;
      var lastSelection = null;
      var mouseDown = false;
      function constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget) {
        var doc2 = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget.document : 9 === nativeEventTarget.nodeType ? nativeEventTarget : nativeEventTarget.ownerDocument;
        mouseDown || null == activeElement || activeElement !== getActiveElement(doc2) || (doc2 = activeElement, "selectionStart" in doc2 && hasSelectionCapabilities(doc2) ? doc2 = { start: doc2.selectionStart, end: doc2.selectionEnd } : (doc2 = (doc2.ownerDocument && doc2.ownerDocument.defaultView || window).getSelection(), doc2 = {
          anchorNode: doc2.anchorNode,
          anchorOffset: doc2.anchorOffset,
          focusNode: doc2.focusNode,
          focusOffset: doc2.focusOffset
        }), lastSelection && shallowEqual(lastSelection, doc2) || (lastSelection = doc2, doc2 = accumulateTwoPhaseListeners(activeElementInst, "onSelect"), 0 < doc2.length && (nativeEvent = new SyntheticEvent(
          "onSelect",
          "select",
          null,
          nativeEvent,
          nativeEventTarget
        ), dispatchQueue.push({ event: nativeEvent, listeners: doc2 }), nativeEvent.target = activeElement)));
      }
      function makePrefixMap(styleProp, eventName) {
        var prefixes = {};
        prefixes[styleProp.toLowerCase()] = eventName.toLowerCase();
        prefixes["Webkit" + styleProp] = "webkit" + eventName;
        prefixes["Moz" + styleProp] = "moz" + eventName;
        return prefixes;
      }
      var vendorPrefixes = {
        animationend: makePrefixMap("Animation", "AnimationEnd"),
        animationiteration: makePrefixMap("Animation", "AnimationIteration"),
        animationstart: makePrefixMap("Animation", "AnimationStart"),
        transitionrun: makePrefixMap("Transition", "TransitionRun"),
        transitionstart: makePrefixMap("Transition", "TransitionStart"),
        transitioncancel: makePrefixMap("Transition", "TransitionCancel"),
        transitionend: makePrefixMap("Transition", "TransitionEnd")
      };
      var prefixedEventNames = {};
      var style = {};
      canUseDOM && (style = document.createElement("div").style, "AnimationEvent" in window || (delete vendorPrefixes.animationend.animation, delete vendorPrefixes.animationiteration.animation, delete vendorPrefixes.animationstart.animation), "TransitionEvent" in window || delete vendorPrefixes.transitionend.transition);
      function getVendorPrefixedEventName(eventName) {
        if (prefixedEventNames[eventName]) return prefixedEventNames[eventName];
        if (!vendorPrefixes[eventName]) return eventName;
        var prefixMap = vendorPrefixes[eventName], styleProp;
        for (styleProp in prefixMap)
          if (prefixMap.hasOwnProperty(styleProp) && styleProp in style)
            return prefixedEventNames[eventName] = prefixMap[styleProp];
        return eventName;
      }
      var ANIMATION_END = getVendorPrefixedEventName("animationend");
      var ANIMATION_ITERATION = getVendorPrefixedEventName("animationiteration");
      var ANIMATION_START = getVendorPrefixedEventName("animationstart");
      var TRANSITION_RUN = getVendorPrefixedEventName("transitionrun");
      var TRANSITION_START = getVendorPrefixedEventName("transitionstart");
      var TRANSITION_CANCEL = getVendorPrefixedEventName("transitioncancel");
      var TRANSITION_END = getVendorPrefixedEventName("transitionend");
      var topLevelEventsToReactNames = /* @__PURE__ */ new Map();
      var simpleEventPluginEvents = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll scrollEnd toggle touchMove waiting wheel".split(
        " "
      );
      function registerSimpleEvent(domEventName, reactName) {
        topLevelEventsToReactNames.set(domEventName, reactName);
        registerTwoPhaseEvent(reactName, [domEventName]);
      }
      var concurrentQueues = [];
      var concurrentQueuesIndex = 0;
      var concurrentlyUpdatedLanes = 0;
      function finishQueueingConcurrentUpdates() {
        for (var endIndex = concurrentQueuesIndex, i = concurrentlyUpdatedLanes = concurrentQueuesIndex = 0; i < endIndex; ) {
          var fiber = concurrentQueues[i];
          concurrentQueues[i++] = null;
          var queue = concurrentQueues[i];
          concurrentQueues[i++] = null;
          var update = concurrentQueues[i];
          concurrentQueues[i++] = null;
          var lane = concurrentQueues[i];
          concurrentQueues[i++] = null;
          if (null !== queue && null !== update) {
            var pending = queue.pending;
            null === pending ? update.next = update : (update.next = pending.next, pending.next = update);
            queue.pending = update;
          }
          0 !== lane && markUpdateLaneFromFiberToRoot(fiber, update, lane);
        }
      }
      function enqueueUpdate$1(fiber, queue, update, lane) {
        concurrentQueues[concurrentQueuesIndex++] = fiber;
        concurrentQueues[concurrentQueuesIndex++] = queue;
        concurrentQueues[concurrentQueuesIndex++] = update;
        concurrentQueues[concurrentQueuesIndex++] = lane;
        concurrentlyUpdatedLanes |= lane;
        fiber.lanes |= lane;
        fiber = fiber.alternate;
        null !== fiber && (fiber.lanes |= lane);
      }
      function enqueueConcurrentHookUpdate(fiber, queue, update, lane) {
        enqueueUpdate$1(fiber, queue, update, lane);
        return getRootForUpdatedFiber(fiber);
      }
      function enqueueConcurrentRenderForLane(fiber, lane) {
        enqueueUpdate$1(fiber, null, null, lane);
        return getRootForUpdatedFiber(fiber);
      }
      function markUpdateLaneFromFiberToRoot(sourceFiber, update, lane) {
        sourceFiber.lanes |= lane;
        var alternate = sourceFiber.alternate;
        null !== alternate && (alternate.lanes |= lane);
        for (var isHidden = false, parent = sourceFiber.return; null !== parent; )
          parent.childLanes |= lane, alternate = parent.alternate, null !== alternate && (alternate.childLanes |= lane), 22 === parent.tag && (sourceFiber = parent.stateNode, null === sourceFiber || sourceFiber._visibility & 1 || (isHidden = true)), sourceFiber = parent, parent = parent.return;
        isHidden && null !== update && 3 === sourceFiber.tag && (parent = sourceFiber.stateNode, isHidden = 31 - clz32(lane), parent = parent.hiddenUpdates, sourceFiber = parent[isHidden], null === sourceFiber ? parent[isHidden] = [update] : sourceFiber.push(update), update.lane = lane | 536870912);
      }
      function getRootForUpdatedFiber(sourceFiber) {
        if (50 < nestedUpdateCount)
          throw nestedUpdateCount = 0, rootWithNestedUpdates = null, Error(formatProdErrorMessage(185));
        for (var parent = sourceFiber.return; null !== parent; )
          sourceFiber = parent, parent = sourceFiber.return;
        return 3 === sourceFiber.tag ? sourceFiber.stateNode : null;
      }
      var emptyContextObject = {};
      var CapturedStacks = /* @__PURE__ */ new WeakMap();
      function createCapturedValueAtFiber(value, source) {
        if ("object" === typeof value && null !== value) {
          var existing = CapturedStacks.get(value);
          if (void 0 !== existing) return existing;
          source = {
            value,
            source,
            stack: getStackByFiberInDevAndProd(source)
          };
          CapturedStacks.set(value, source);
          return source;
        }
        return {
          value,
          source,
          stack: getStackByFiberInDevAndProd(source)
        };
      }
      var forkStack = [];
      var forkStackIndex = 0;
      var treeForkProvider = null;
      var treeForkCount = 0;
      var idStack = [];
      var idStackIndex = 0;
      var treeContextProvider = null;
      var treeContextId = 1;
      var treeContextOverflow = "";
      function pushTreeFork(workInProgress2, totalChildren) {
        forkStack[forkStackIndex++] = treeForkCount;
        forkStack[forkStackIndex++] = treeForkProvider;
        treeForkProvider = workInProgress2;
        treeForkCount = totalChildren;
      }
      function pushTreeId(workInProgress2, totalChildren, index2) {
        idStack[idStackIndex++] = treeContextId;
        idStack[idStackIndex++] = treeContextOverflow;
        idStack[idStackIndex++] = treeContextProvider;
        treeContextProvider = workInProgress2;
        var baseIdWithLeadingBit = treeContextId;
        workInProgress2 = treeContextOverflow;
        var baseLength = 32 - clz32(baseIdWithLeadingBit) - 1;
        baseIdWithLeadingBit &= ~(1 << baseLength);
        index2 += 1;
        var length = 32 - clz32(totalChildren) + baseLength;
        if (30 < length) {
          var numberOfOverflowBits = baseLength - baseLength % 5;
          length = (baseIdWithLeadingBit & (1 << numberOfOverflowBits) - 1).toString(32);
          baseIdWithLeadingBit >>= numberOfOverflowBits;
          baseLength -= numberOfOverflowBits;
          treeContextId = 1 << 32 - clz32(totalChildren) + baseLength | index2 << baseLength | baseIdWithLeadingBit;
          treeContextOverflow = length + workInProgress2;
        } else
          treeContextId = 1 << length | index2 << baseLength | baseIdWithLeadingBit, treeContextOverflow = workInProgress2;
      }
      function pushMaterializedTreeId(workInProgress2) {
        null !== workInProgress2.return && (pushTreeFork(workInProgress2, 1), pushTreeId(workInProgress2, 1, 0));
      }
      function popTreeContext(workInProgress2) {
        for (; workInProgress2 === treeForkProvider; )
          treeForkProvider = forkStack[--forkStackIndex], forkStack[forkStackIndex] = null, treeForkCount = forkStack[--forkStackIndex], forkStack[forkStackIndex] = null;
        for (; workInProgress2 === treeContextProvider; )
          treeContextProvider = idStack[--idStackIndex], idStack[idStackIndex] = null, treeContextOverflow = idStack[--idStackIndex], idStack[idStackIndex] = null, treeContextId = idStack[--idStackIndex], idStack[idStackIndex] = null;
      }
      var hydrationParentFiber = null;
      var nextHydratableInstance = null;
      var isHydrating = false;
      var hydrationErrors = null;
      var rootOrSingletonContext = false;
      var HydrationMismatchException = Error(formatProdErrorMessage(519));
      function throwOnHydrationMismatch(fiber) {
        var error = Error(formatProdErrorMessage(418, ""));
        queueHydrationError(createCapturedValueAtFiber(error, fiber));
        throw HydrationMismatchException;
      }
      function prepareToHydrateHostInstance(fiber) {
        var instance = fiber.stateNode, type2 = fiber.type, props = fiber.memoizedProps;
        instance[internalInstanceKey] = fiber;
        instance[internalPropsKey] = props;
        switch (type2) {
          case "dialog":
            listenToNonDelegatedEvent("cancel", instance);
            listenToNonDelegatedEvent("close", instance);
            break;
          case "iframe":
          case "object":
          case "embed":
            listenToNonDelegatedEvent("load", instance);
            break;
          case "video":
          case "audio":
            for (type2 = 0; type2 < mediaEventTypes.length; type2++)
              listenToNonDelegatedEvent(mediaEventTypes[type2], instance);
            break;
          case "source":
            listenToNonDelegatedEvent("error", instance);
            break;
          case "img":
          case "image":
          case "link":
            listenToNonDelegatedEvent("error", instance);
            listenToNonDelegatedEvent("load", instance);
            break;
          case "details":
            listenToNonDelegatedEvent("toggle", instance);
            break;
          case "input":
            listenToNonDelegatedEvent("invalid", instance);
            initInput(
              instance,
              props.value,
              props.defaultValue,
              props.checked,
              props.defaultChecked,
              props.type,
              props.name,
              true
            );
            track(instance);
            break;
          case "select":
            listenToNonDelegatedEvent("invalid", instance);
            break;
          case "textarea":
            listenToNonDelegatedEvent("invalid", instance), initTextarea(instance, props.value, props.defaultValue, props.children), track(instance);
        }
        type2 = props.children;
        "string" !== typeof type2 && "number" !== typeof type2 && "bigint" !== typeof type2 || instance.textContent === "" + type2 || true === props.suppressHydrationWarning || checkForUnmatchedText(instance.textContent, type2) ? (null != props.popover && (listenToNonDelegatedEvent("beforetoggle", instance), listenToNonDelegatedEvent("toggle", instance)), null != props.onScroll && listenToNonDelegatedEvent("scroll", instance), null != props.onScrollEnd && listenToNonDelegatedEvent("scrollend", instance), null != props.onClick && (instance.onclick = noop$1), instance = true) : instance = false;
        instance || throwOnHydrationMismatch(fiber);
      }
      function popToNextHostParent(fiber) {
        for (hydrationParentFiber = fiber.return; hydrationParentFiber; )
          switch (hydrationParentFiber.tag) {
            case 3:
            case 27:
              rootOrSingletonContext = true;
              return;
            case 5:
            case 13:
              rootOrSingletonContext = false;
              return;
            default:
              hydrationParentFiber = hydrationParentFiber.return;
          }
      }
      function popHydrationState(fiber) {
        if (fiber !== hydrationParentFiber) return false;
        if (!isHydrating) return popToNextHostParent(fiber), isHydrating = true, false;
        var shouldClear = false, JSCompiler_temp;
        if (JSCompiler_temp = 3 !== fiber.tag && 27 !== fiber.tag) {
          if (JSCompiler_temp = 5 === fiber.tag)
            JSCompiler_temp = fiber.type, JSCompiler_temp = !("form" !== JSCompiler_temp && "button" !== JSCompiler_temp) || shouldSetTextContent(fiber.type, fiber.memoizedProps);
          JSCompiler_temp = !JSCompiler_temp;
        }
        JSCompiler_temp && (shouldClear = true);
        shouldClear && nextHydratableInstance && throwOnHydrationMismatch(fiber);
        popToNextHostParent(fiber);
        if (13 === fiber.tag) {
          fiber = fiber.memoizedState;
          fiber = null !== fiber ? fiber.dehydrated : null;
          if (!fiber) throw Error(formatProdErrorMessage(317));
          a: {
            fiber = fiber.nextSibling;
            for (shouldClear = 0; fiber; ) {
              if (8 === fiber.nodeType)
                if (JSCompiler_temp = fiber.data, "/$" === JSCompiler_temp) {
                  if (0 === shouldClear) {
                    nextHydratableInstance = getNextHydratable(fiber.nextSibling);
                    break a;
                  }
                  shouldClear--;
                } else
                  "$" !== JSCompiler_temp && "$!" !== JSCompiler_temp && "$?" !== JSCompiler_temp || shouldClear++;
              fiber = fiber.nextSibling;
            }
            nextHydratableInstance = null;
          }
        } else
          nextHydratableInstance = hydrationParentFiber ? getNextHydratable(fiber.stateNode.nextSibling) : null;
        return true;
      }
      function resetHydrationState() {
        nextHydratableInstance = hydrationParentFiber = null;
        isHydrating = false;
      }
      function queueHydrationError(error) {
        null === hydrationErrors ? hydrationErrors = [error] : hydrationErrors.push(error);
      }
      var SuspenseException = Error(formatProdErrorMessage(460));
      var SuspenseyCommitException = Error(formatProdErrorMessage(474));
      var noopSuspenseyCommitThenable = { then: function() {
      } };
      function isThenableResolved(thenable) {
        thenable = thenable.status;
        return "fulfilled" === thenable || "rejected" === thenable;
      }
      function noop$3() {
      }
      function trackUsedThenable(thenableState2, thenable, index2) {
        index2 = thenableState2[index2];
        void 0 === index2 ? thenableState2.push(thenable) : index2 !== thenable && (thenable.then(noop$3, noop$3), thenable = index2);
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            thenableState2 = thenable.reason;
            if (thenableState2 === SuspenseException)
              throw Error(formatProdErrorMessage(483));
            throw thenableState2;
          default:
            if ("string" === typeof thenable.status) thenable.then(noop$3, noop$3);
            else {
              thenableState2 = workInProgressRoot;
              if (null !== thenableState2 && 100 < thenableState2.shellSuspendCounter)
                throw Error(formatProdErrorMessage(482));
              thenableState2 = thenable;
              thenableState2.status = "pending";
              thenableState2.then(
                function(fulfilledValue) {
                  if ("pending" === thenable.status) {
                    var fulfilledThenable = thenable;
                    fulfilledThenable.status = "fulfilled";
                    fulfilledThenable.value = fulfilledValue;
                  }
                },
                function(error) {
                  if ("pending" === thenable.status) {
                    var rejectedThenable = thenable;
                    rejectedThenable.status = "rejected";
                    rejectedThenable.reason = error;
                  }
                }
              );
            }
            switch (thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                thenableState2 = thenable.reason;
                if (thenableState2 === SuspenseException)
                  throw Error(formatProdErrorMessage(483));
                throw thenableState2;
            }
            suspendedThenable = thenable;
            throw SuspenseException;
        }
      }
      var suspendedThenable = null;
      function getSuspendedThenable() {
        if (null === suspendedThenable) throw Error(formatProdErrorMessage(459));
        var thenable = suspendedThenable;
        suspendedThenable = null;
        return thenable;
      }
      var thenableState$1 = null;
      var thenableIndexCounter$1 = 0;
      function unwrapThenable(thenable) {
        var index2 = thenableIndexCounter$1;
        thenableIndexCounter$1 += 1;
        null === thenableState$1 && (thenableState$1 = []);
        return trackUsedThenable(thenableState$1, thenable, index2);
      }
      function coerceRef(workInProgress2, element) {
        element = element.props.ref;
        workInProgress2.ref = void 0 !== element ? element : null;
      }
      function throwOnInvalidObjectType(returnFiber, newChild) {
        if (newChild.$$typeof === REACT_LEGACY_ELEMENT_TYPE)
          throw Error(formatProdErrorMessage(525));
        returnFiber = Object.prototype.toString.call(newChild);
        throw Error(
          formatProdErrorMessage(
            31,
            "[object Object]" === returnFiber ? "object with keys {" + Object.keys(newChild).join(", ") + "}" : returnFiber
          )
        );
      }
      function resolveLazy(lazyType) {
        var init = lazyType._init;
        return init(lazyType._payload);
      }
      function createChildReconciler(shouldTrackSideEffects) {
        function deleteChild(returnFiber, childToDelete) {
          if (shouldTrackSideEffects) {
            var deletions = returnFiber.deletions;
            null === deletions ? (returnFiber.deletions = [childToDelete], returnFiber.flags |= 16) : deletions.push(childToDelete);
          }
        }
        function deleteRemainingChildren(returnFiber, currentFirstChild) {
          if (!shouldTrackSideEffects) return null;
          for (; null !== currentFirstChild; )
            deleteChild(returnFiber, currentFirstChild), currentFirstChild = currentFirstChild.sibling;
          return null;
        }
        function mapRemainingChildren(currentFirstChild) {
          for (var existingChildren = /* @__PURE__ */ new Map(); null !== currentFirstChild; )
            null !== currentFirstChild.key ? existingChildren.set(currentFirstChild.key, currentFirstChild) : existingChildren.set(currentFirstChild.index, currentFirstChild), currentFirstChild = currentFirstChild.sibling;
          return existingChildren;
        }
        function useFiber(fiber, pendingProps) {
          fiber = createWorkInProgress(fiber, pendingProps);
          fiber.index = 0;
          fiber.sibling = null;
          return fiber;
        }
        function placeChild(newFiber, lastPlacedIndex, newIndex) {
          newFiber.index = newIndex;
          if (!shouldTrackSideEffects)
            return newFiber.flags |= 1048576, lastPlacedIndex;
          newIndex = newFiber.alternate;
          if (null !== newIndex)
            return newIndex = newIndex.index, newIndex < lastPlacedIndex ? (newFiber.flags |= 33554434, lastPlacedIndex) : newIndex;
          newFiber.flags |= 33554434;
          return lastPlacedIndex;
        }
        function placeSingleChild(newFiber) {
          shouldTrackSideEffects && null === newFiber.alternate && (newFiber.flags |= 33554434);
          return newFiber;
        }
        function updateTextNode(returnFiber, current, textContent, lanes) {
          if (null === current || 6 !== current.tag)
            return current = createFiberFromText(textContent, returnFiber.mode, lanes), current.return = returnFiber, current;
          current = useFiber(current, textContent);
          current.return = returnFiber;
          return current;
        }
        function updateElement(returnFiber, current, element, lanes) {
          var elementType = element.type;
          if (elementType === REACT_FRAGMENT_TYPE)
            return updateFragment(
              returnFiber,
              current,
              element.props.children,
              lanes,
              element.key
            );
          if (null !== current && (current.elementType === elementType || "object" === typeof elementType && null !== elementType && elementType.$$typeof === REACT_LAZY_TYPE && resolveLazy(elementType) === current.type))
            return current = useFiber(current, element.props), coerceRef(current, element), current.return = returnFiber, current;
          current = createFiberFromTypeAndProps(
            element.type,
            element.key,
            element.props,
            null,
            returnFiber.mode,
            lanes
          );
          coerceRef(current, element);
          current.return = returnFiber;
          return current;
        }
        function updatePortal(returnFiber, current, portal, lanes) {
          if (null === current || 4 !== current.tag || current.stateNode.containerInfo !== portal.containerInfo || current.stateNode.implementation !== portal.implementation)
            return current = createFiberFromPortal(portal, returnFiber.mode, lanes), current.return = returnFiber, current;
          current = useFiber(current, portal.children || []);
          current.return = returnFiber;
          return current;
        }
        function updateFragment(returnFiber, current, fragment, lanes, key) {
          if (null === current || 7 !== current.tag)
            return current = createFiberFromFragment(
              fragment,
              returnFiber.mode,
              lanes,
              key
            ), current.return = returnFiber, current;
          current = useFiber(current, fragment);
          current.return = returnFiber;
          return current;
        }
        function createChild(returnFiber, newChild, lanes) {
          if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
            return newChild = createFiberFromText(
              "" + newChild,
              returnFiber.mode,
              lanes
            ), newChild.return = returnFiber, newChild;
          if ("object" === typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                return lanes = createFiberFromTypeAndProps(
                  newChild.type,
                  newChild.key,
                  newChild.props,
                  null,
                  returnFiber.mode,
                  lanes
                ), coerceRef(lanes, newChild), lanes.return = returnFiber, lanes;
              case REACT_PORTAL_TYPE:
                return newChild = createFiberFromPortal(
                  newChild,
                  returnFiber.mode,
                  lanes
                ), newChild.return = returnFiber, newChild;
              case REACT_LAZY_TYPE:
                var init = newChild._init;
                newChild = init(newChild._payload);
                return createChild(returnFiber, newChild, lanes);
            }
            if (isArrayImpl(newChild) || getIteratorFn(newChild))
              return newChild = createFiberFromFragment(
                newChild,
                returnFiber.mode,
                lanes,
                null
              ), newChild.return = returnFiber, newChild;
            if ("function" === typeof newChild.then)
              return createChild(returnFiber, unwrapThenable(newChild), lanes);
            if (newChild.$$typeof === REACT_CONTEXT_TYPE)
              return createChild(
                returnFiber,
                readContextDuringReconciliation(returnFiber, newChild),
                lanes
              );
            throwOnInvalidObjectType(returnFiber, newChild);
          }
          return null;
        }
        function updateSlot(returnFiber, oldFiber, newChild, lanes) {
          var key = null !== oldFiber ? oldFiber.key : null;
          if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
            return null !== key ? null : updateTextNode(returnFiber, oldFiber, "" + newChild, lanes);
          if ("object" === typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                return newChild.key === key ? updateElement(returnFiber, oldFiber, newChild, lanes) : null;
              case REACT_PORTAL_TYPE:
                return newChild.key === key ? updatePortal(returnFiber, oldFiber, newChild, lanes) : null;
              case REACT_LAZY_TYPE:
                return key = newChild._init, newChild = key(newChild._payload), updateSlot(returnFiber, oldFiber, newChild, lanes);
            }
            if (isArrayImpl(newChild) || getIteratorFn(newChild))
              return null !== key ? null : updateFragment(returnFiber, oldFiber, newChild, lanes, null);
            if ("function" === typeof newChild.then)
              return updateSlot(
                returnFiber,
                oldFiber,
                unwrapThenable(newChild),
                lanes
              );
            if (newChild.$$typeof === REACT_CONTEXT_TYPE)
              return updateSlot(
                returnFiber,
                oldFiber,
                readContextDuringReconciliation(returnFiber, newChild),
                lanes
              );
            throwOnInvalidObjectType(returnFiber, newChild);
          }
          return null;
        }
        function updateFromMap(existingChildren, returnFiber, newIdx, newChild, lanes) {
          if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
            return existingChildren = existingChildren.get(newIdx) || null, updateTextNode(returnFiber, existingChildren, "" + newChild, lanes);
          if ("object" === typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                return existingChildren = existingChildren.get(
                  null === newChild.key ? newIdx : newChild.key
                ) || null, updateElement(returnFiber, existingChildren, newChild, lanes);
              case REACT_PORTAL_TYPE:
                return existingChildren = existingChildren.get(
                  null === newChild.key ? newIdx : newChild.key
                ) || null, updatePortal(returnFiber, existingChildren, newChild, lanes);
              case REACT_LAZY_TYPE:
                var init = newChild._init;
                newChild = init(newChild._payload);
                return updateFromMap(
                  existingChildren,
                  returnFiber,
                  newIdx,
                  newChild,
                  lanes
                );
            }
            if (isArrayImpl(newChild) || getIteratorFn(newChild))
              return existingChildren = existingChildren.get(newIdx) || null, updateFragment(returnFiber, existingChildren, newChild, lanes, null);
            if ("function" === typeof newChild.then)
              return updateFromMap(
                existingChildren,
                returnFiber,
                newIdx,
                unwrapThenable(newChild),
                lanes
              );
            if (newChild.$$typeof === REACT_CONTEXT_TYPE)
              return updateFromMap(
                existingChildren,
                returnFiber,
                newIdx,
                readContextDuringReconciliation(returnFiber, newChild),
                lanes
              );
            throwOnInvalidObjectType(returnFiber, newChild);
          }
          return null;
        }
        function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, lanes) {
          for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, newIdx = currentFirstChild = 0, nextOldFiber = null; null !== oldFiber && newIdx < newChildren.length; newIdx++) {
            oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
            var newFiber = updateSlot(
              returnFiber,
              oldFiber,
              newChildren[newIdx],
              lanes
            );
            if (null === newFiber) {
              null === oldFiber && (oldFiber = nextOldFiber);
              break;
            }
            shouldTrackSideEffects && oldFiber && null === newFiber.alternate && deleteChild(returnFiber, oldFiber);
            currentFirstChild = placeChild(newFiber, currentFirstChild, newIdx);
            null === previousNewFiber ? resultingFirstChild = newFiber : previousNewFiber.sibling = newFiber;
            previousNewFiber = newFiber;
            oldFiber = nextOldFiber;
          }
          if (newIdx === newChildren.length)
            return deleteRemainingChildren(returnFiber, oldFiber), isHydrating && pushTreeFork(returnFiber, newIdx), resultingFirstChild;
          if (null === oldFiber) {
            for (; newIdx < newChildren.length; newIdx++)
              oldFiber = createChild(returnFiber, newChildren[newIdx], lanes), null !== oldFiber && (currentFirstChild = placeChild(
                oldFiber,
                currentFirstChild,
                newIdx
              ), null === previousNewFiber ? resultingFirstChild = oldFiber : previousNewFiber.sibling = oldFiber, previousNewFiber = oldFiber);
            isHydrating && pushTreeFork(returnFiber, newIdx);
            return resultingFirstChild;
          }
          for (oldFiber = mapRemainingChildren(oldFiber); newIdx < newChildren.length; newIdx++)
            nextOldFiber = updateFromMap(
              oldFiber,
              returnFiber,
              newIdx,
              newChildren[newIdx],
              lanes
            ), null !== nextOldFiber && (shouldTrackSideEffects && null !== nextOldFiber.alternate && oldFiber.delete(
              null === nextOldFiber.key ? newIdx : nextOldFiber.key
            ), currentFirstChild = placeChild(
              nextOldFiber,
              currentFirstChild,
              newIdx
            ), null === previousNewFiber ? resultingFirstChild = nextOldFiber : previousNewFiber.sibling = nextOldFiber, previousNewFiber = nextOldFiber);
          shouldTrackSideEffects && oldFiber.forEach(function(child) {
            return deleteChild(returnFiber, child);
          });
          isHydrating && pushTreeFork(returnFiber, newIdx);
          return resultingFirstChild;
        }
        function reconcileChildrenIterator(returnFiber, currentFirstChild, newChildren, lanes) {
          if (null == newChildren) throw Error(formatProdErrorMessage(151));
          for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, newIdx = currentFirstChild = 0, nextOldFiber = null, step = newChildren.next(); null !== oldFiber && !step.done; newIdx++, step = newChildren.next()) {
            oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
            var newFiber = updateSlot(returnFiber, oldFiber, step.value, lanes);
            if (null === newFiber) {
              null === oldFiber && (oldFiber = nextOldFiber);
              break;
            }
            shouldTrackSideEffects && oldFiber && null === newFiber.alternate && deleteChild(returnFiber, oldFiber);
            currentFirstChild = placeChild(newFiber, currentFirstChild, newIdx);
            null === previousNewFiber ? resultingFirstChild = newFiber : previousNewFiber.sibling = newFiber;
            previousNewFiber = newFiber;
            oldFiber = nextOldFiber;
          }
          if (step.done)
            return deleteRemainingChildren(returnFiber, oldFiber), isHydrating && pushTreeFork(returnFiber, newIdx), resultingFirstChild;
          if (null === oldFiber) {
            for (; !step.done; newIdx++, step = newChildren.next())
              step = createChild(returnFiber, step.value, lanes), null !== step && (currentFirstChild = placeChild(step, currentFirstChild, newIdx), null === previousNewFiber ? resultingFirstChild = step : previousNewFiber.sibling = step, previousNewFiber = step);
            isHydrating && pushTreeFork(returnFiber, newIdx);
            return resultingFirstChild;
          }
          for (oldFiber = mapRemainingChildren(oldFiber); !step.done; newIdx++, step = newChildren.next())
            step = updateFromMap(oldFiber, returnFiber, newIdx, step.value, lanes), null !== step && (shouldTrackSideEffects && null !== step.alternate && oldFiber.delete(null === step.key ? newIdx : step.key), currentFirstChild = placeChild(step, currentFirstChild, newIdx), null === previousNewFiber ? resultingFirstChild = step : previousNewFiber.sibling = step, previousNewFiber = step);
          shouldTrackSideEffects && oldFiber.forEach(function(child) {
            return deleteChild(returnFiber, child);
          });
          isHydrating && pushTreeFork(returnFiber, newIdx);
          return resultingFirstChild;
        }
        function reconcileChildFibersImpl(returnFiber, currentFirstChild, newChild, lanes) {
          "object" === typeof newChild && null !== newChild && newChild.type === REACT_FRAGMENT_TYPE && null === newChild.key && (newChild = newChild.props.children);
          if ("object" === typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                a: {
                  for (var key = newChild.key; null !== currentFirstChild; ) {
                    if (currentFirstChild.key === key) {
                      key = newChild.type;
                      if (key === REACT_FRAGMENT_TYPE) {
                        if (7 === currentFirstChild.tag) {
                          deleteRemainingChildren(
                            returnFiber,
                            currentFirstChild.sibling
                          );
                          lanes = useFiber(
                            currentFirstChild,
                            newChild.props.children
                          );
                          lanes.return = returnFiber;
                          returnFiber = lanes;
                          break a;
                        }
                      } else if (currentFirstChild.elementType === key || "object" === typeof key && null !== key && key.$$typeof === REACT_LAZY_TYPE && resolveLazy(key) === currentFirstChild.type) {
                        deleteRemainingChildren(
                          returnFiber,
                          currentFirstChild.sibling
                        );
                        lanes = useFiber(currentFirstChild, newChild.props);
                        coerceRef(lanes, newChild);
                        lanes.return = returnFiber;
                        returnFiber = lanes;
                        break a;
                      }
                      deleteRemainingChildren(returnFiber, currentFirstChild);
                      break;
                    } else deleteChild(returnFiber, currentFirstChild);
                    currentFirstChild = currentFirstChild.sibling;
                  }
                  newChild.type === REACT_FRAGMENT_TYPE ? (lanes = createFiberFromFragment(
                    newChild.props.children,
                    returnFiber.mode,
                    lanes,
                    newChild.key
                  ), lanes.return = returnFiber, returnFiber = lanes) : (lanes = createFiberFromTypeAndProps(
                    newChild.type,
                    newChild.key,
                    newChild.props,
                    null,
                    returnFiber.mode,
                    lanes
                  ), coerceRef(lanes, newChild), lanes.return = returnFiber, returnFiber = lanes);
                }
                return placeSingleChild(returnFiber);
              case REACT_PORTAL_TYPE:
                a: {
                  for (key = newChild.key; null !== currentFirstChild; ) {
                    if (currentFirstChild.key === key)
                      if (4 === currentFirstChild.tag && currentFirstChild.stateNode.containerInfo === newChild.containerInfo && currentFirstChild.stateNode.implementation === newChild.implementation) {
                        deleteRemainingChildren(
                          returnFiber,
                          currentFirstChild.sibling
                        );
                        lanes = useFiber(currentFirstChild, newChild.children || []);
                        lanes.return = returnFiber;
                        returnFiber = lanes;
                        break a;
                      } else {
                        deleteRemainingChildren(returnFiber, currentFirstChild);
                        break;
                      }
                    else deleteChild(returnFiber, currentFirstChild);
                    currentFirstChild = currentFirstChild.sibling;
                  }
                  lanes = createFiberFromPortal(newChild, returnFiber.mode, lanes);
                  lanes.return = returnFiber;
                  returnFiber = lanes;
                }
                return placeSingleChild(returnFiber);
              case REACT_LAZY_TYPE:
                return key = newChild._init, newChild = key(newChild._payload), reconcileChildFibersImpl(
                  returnFiber,
                  currentFirstChild,
                  newChild,
                  lanes
                );
            }
            if (isArrayImpl(newChild))
              return reconcileChildrenArray(
                returnFiber,
                currentFirstChild,
                newChild,
                lanes
              );
            if (getIteratorFn(newChild)) {
              key = getIteratorFn(newChild);
              if ("function" !== typeof key) throw Error(formatProdErrorMessage(150));
              newChild = key.call(newChild);
              return reconcileChildrenIterator(
                returnFiber,
                currentFirstChild,
                newChild,
                lanes
              );
            }
            if ("function" === typeof newChild.then)
              return reconcileChildFibersImpl(
                returnFiber,
                currentFirstChild,
                unwrapThenable(newChild),
                lanes
              );
            if (newChild.$$typeof === REACT_CONTEXT_TYPE)
              return reconcileChildFibersImpl(
                returnFiber,
                currentFirstChild,
                readContextDuringReconciliation(returnFiber, newChild),
                lanes
              );
            throwOnInvalidObjectType(returnFiber, newChild);
          }
          return "string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild ? (newChild = "" + newChild, null !== currentFirstChild && 6 === currentFirstChild.tag ? (deleteRemainingChildren(returnFiber, currentFirstChild.sibling), lanes = useFiber(currentFirstChild, newChild), lanes.return = returnFiber, returnFiber = lanes) : (deleteRemainingChildren(returnFiber, currentFirstChild), lanes = createFiberFromText(newChild, returnFiber.mode, lanes), lanes.return = returnFiber, returnFiber = lanes), placeSingleChild(returnFiber)) : deleteRemainingChildren(returnFiber, currentFirstChild);
        }
        return function(returnFiber, currentFirstChild, newChild, lanes) {
          try {
            thenableIndexCounter$1 = 0;
            var firstChildFiber = reconcileChildFibersImpl(
              returnFiber,
              currentFirstChild,
              newChild,
              lanes
            );
            thenableState$1 = null;
            return firstChildFiber;
          } catch (x) {
            if (x === SuspenseException) throw x;
            var fiber = createFiberImplClass(29, x, null, returnFiber.mode);
            fiber.lanes = lanes;
            fiber.return = returnFiber;
            return fiber;
          } finally {
          }
        };
      }
      var reconcileChildFibers = createChildReconciler(true);
      var mountChildFibers = createChildReconciler(false);
      var currentTreeHiddenStackCursor = createCursor(null);
      var prevEntangledRenderLanesCursor = createCursor(0);
      function pushHiddenContext(fiber, context) {
        fiber = entangledRenderLanes;
        push(prevEntangledRenderLanesCursor, fiber);
        push(currentTreeHiddenStackCursor, context);
        entangledRenderLanes = fiber | context.baseLanes;
      }
      function reuseHiddenContextOnStack() {
        push(prevEntangledRenderLanesCursor, entangledRenderLanes);
        push(currentTreeHiddenStackCursor, currentTreeHiddenStackCursor.current);
      }
      function popHiddenContext() {
        entangledRenderLanes = prevEntangledRenderLanesCursor.current;
        pop(currentTreeHiddenStackCursor);
        pop(prevEntangledRenderLanesCursor);
      }
      var suspenseHandlerStackCursor = createCursor(null);
      var shellBoundary = null;
      function pushPrimaryTreeSuspenseHandler(handler) {
        var current = handler.alternate;
        push(suspenseStackCursor, suspenseStackCursor.current & 1);
        push(suspenseHandlerStackCursor, handler);
        null === shellBoundary && (null === current || null !== currentTreeHiddenStackCursor.current ? shellBoundary = handler : null !== current.memoizedState && (shellBoundary = handler));
      }
      function pushOffscreenSuspenseHandler(fiber) {
        if (22 === fiber.tag) {
          if (push(suspenseStackCursor, suspenseStackCursor.current), push(suspenseHandlerStackCursor, fiber), null === shellBoundary) {
            var current = fiber.alternate;
            null !== current && null !== current.memoizedState && (shellBoundary = fiber);
          }
        } else reuseSuspenseHandlerOnStack(fiber);
      }
      function reuseSuspenseHandlerOnStack() {
        push(suspenseStackCursor, suspenseStackCursor.current);
        push(suspenseHandlerStackCursor, suspenseHandlerStackCursor.current);
      }
      function popSuspenseHandler(fiber) {
        pop(suspenseHandlerStackCursor);
        shellBoundary === fiber && (shellBoundary = null);
        pop(suspenseStackCursor);
      }
      var suspenseStackCursor = createCursor(0);
      function findFirstSuspended(row) {
        for (var node = row; null !== node; ) {
          if (13 === node.tag) {
            var state = node.memoizedState;
            if (null !== state && (state = state.dehydrated, null === state || "$?" === state.data || "$!" === state.data))
              return node;
          } else if (19 === node.tag && void 0 !== node.memoizedProps.revealOrder) {
            if (0 !== (node.flags & 128)) return node;
          } else if (null !== node.child) {
            node.child.return = node;
            node = node.child;
            continue;
          }
          if (node === row) break;
          for (; null === node.sibling; ) {
            if (null === node.return || node.return === row) return null;
            node = node.return;
          }
          node.sibling.return = node.return;
          node = node.sibling;
        }
        return null;
      }
      var AbortControllerLocal = "undefined" !== typeof AbortController ? AbortController : function() {
        var listeners = [], signal = this.signal = {
          aborted: false,
          addEventListener: function(type2, listener) {
            listeners.push(listener);
          }
        };
        this.abort = function() {
          signal.aborted = true;
          listeners.forEach(function(listener) {
            return listener();
          });
        };
      };
      var scheduleCallback$2 = Scheduler.unstable_scheduleCallback;
      var NormalPriority = Scheduler.unstable_NormalPriority;
      var CacheContext = {
        $$typeof: REACT_CONTEXT_TYPE,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      };
      function createCache() {
        return {
          controller: new AbortControllerLocal(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function releaseCache(cache) {
        cache.refCount--;
        0 === cache.refCount && scheduleCallback$2(NormalPriority, function() {
          cache.controller.abort();
        });
      }
      var currentEntangledListeners = null;
      var currentEntangledPendingCount = 0;
      var currentEntangledLane = 0;
      var currentEntangledActionThenable = null;
      function entangleAsyncAction(transition, thenable) {
        if (null === currentEntangledListeners) {
          var entangledListeners = currentEntangledListeners = [];
          currentEntangledPendingCount = 0;
          currentEntangledLane = requestTransitionLane();
          currentEntangledActionThenable = {
            status: "pending",
            value: void 0,
            then: function(resolve) {
              entangledListeners.push(resolve);
            }
          };
        }
        currentEntangledPendingCount++;
        thenable.then(pingEngtangledActionScope, pingEngtangledActionScope);
        return thenable;
      }
      function pingEngtangledActionScope() {
        if (0 === --currentEntangledPendingCount && null !== currentEntangledListeners) {
          null !== currentEntangledActionThenable && (currentEntangledActionThenable.status = "fulfilled");
          var listeners = currentEntangledListeners;
          currentEntangledListeners = null;
          currentEntangledLane = 0;
          currentEntangledActionThenable = null;
          for (var i = 0; i < listeners.length; i++) (0, listeners[i])();
        }
      }
      function chainThenableValue(thenable, result) {
        var listeners = [], thenableWithOverride = {
          status: "pending",
          value: null,
          reason: null,
          then: function(resolve) {
            listeners.push(resolve);
          }
        };
        thenable.then(
          function() {
            thenableWithOverride.status = "fulfilled";
            thenableWithOverride.value = result;
            for (var i = 0; i < listeners.length; i++) (0, listeners[i])(result);
          },
          function(error) {
            thenableWithOverride.status = "rejected";
            thenableWithOverride.reason = error;
            for (error = 0; error < listeners.length; error++)
              (0, listeners[error])(void 0);
          }
        );
        return thenableWithOverride;
      }
      var prevOnStartTransitionFinish = ReactSharedInternals.S;
      ReactSharedInternals.S = function(transition, returnValue) {
        "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && entangleAsyncAction(transition, returnValue);
        null !== prevOnStartTransitionFinish && prevOnStartTransitionFinish(transition, returnValue);
      };
      var resumedCache = createCursor(null);
      function peekCacheFromPool() {
        var cacheResumedFromPreviousRender = resumedCache.current;
        return null !== cacheResumedFromPreviousRender ? cacheResumedFromPreviousRender : workInProgressRoot.pooledCache;
      }
      function pushTransition(offscreenWorkInProgress, prevCachePool) {
        null === prevCachePool ? push(resumedCache, resumedCache.current) : push(resumedCache, prevCachePool.pool);
      }
      function getSuspendedCache() {
        var cacheFromPool = peekCacheFromPool();
        return null === cacheFromPool ? null : { parent: CacheContext._currentValue, pool: cacheFromPool };
      }
      var renderLanes = 0;
      var currentlyRenderingFiber$1 = null;
      var currentHook = null;
      var workInProgressHook = null;
      var didScheduleRenderPhaseUpdate = false;
      var didScheduleRenderPhaseUpdateDuringThisPass = false;
      var shouldDoubleInvokeUserFnsInHooksDEV = false;
      var localIdCounter = 0;
      var thenableIndexCounter = 0;
      var thenableState = null;
      var globalClientIdCounter = 0;
      function throwInvalidHookError() {
        throw Error(formatProdErrorMessage(321));
      }
      function areHookInputsEqual(nextDeps, prevDeps) {
        if (null === prevDeps) return false;
        for (var i = 0; i < prevDeps.length && i < nextDeps.length; i++)
          if (!objectIs(nextDeps[i], prevDeps[i])) return false;
        return true;
      }
      function renderWithHooks(current, workInProgress2, Component, props, secondArg, nextRenderLanes) {
        renderLanes = nextRenderLanes;
        currentlyRenderingFiber$1 = workInProgress2;
        workInProgress2.memoizedState = null;
        workInProgress2.updateQueue = null;
        workInProgress2.lanes = 0;
        ReactSharedInternals.H = null === current || null === current.memoizedState ? HooksDispatcherOnMount : HooksDispatcherOnUpdate;
        shouldDoubleInvokeUserFnsInHooksDEV = false;
        nextRenderLanes = Component(props, secondArg);
        shouldDoubleInvokeUserFnsInHooksDEV = false;
        didScheduleRenderPhaseUpdateDuringThisPass && (nextRenderLanes = renderWithHooksAgain(
          workInProgress2,
          Component,
          props,
          secondArg
        ));
        finishRenderingHooks(current);
        return nextRenderLanes;
      }
      function finishRenderingHooks(current) {
        ReactSharedInternals.H = ContextOnlyDispatcher;
        var didRenderTooFewHooks = null !== currentHook && null !== currentHook.next;
        renderLanes = 0;
        workInProgressHook = currentHook = currentlyRenderingFiber$1 = null;
        didScheduleRenderPhaseUpdate = false;
        thenableIndexCounter = 0;
        thenableState = null;
        if (didRenderTooFewHooks) throw Error(formatProdErrorMessage(300));
        null === current || didReceiveUpdate || (current = current.dependencies, null !== current && checkIfContextChanged(current) && (didReceiveUpdate = true));
      }
      function renderWithHooksAgain(workInProgress2, Component, props, secondArg) {
        currentlyRenderingFiber$1 = workInProgress2;
        var numberOfReRenders = 0;
        do {
          didScheduleRenderPhaseUpdateDuringThisPass && (thenableState = null);
          thenableIndexCounter = 0;
          didScheduleRenderPhaseUpdateDuringThisPass = false;
          if (25 <= numberOfReRenders) throw Error(formatProdErrorMessage(301));
          numberOfReRenders += 1;
          workInProgressHook = currentHook = null;
          if (null != workInProgress2.updateQueue) {
            var children = workInProgress2.updateQueue;
            children.lastEffect = null;
            children.events = null;
            children.stores = null;
            null != children.memoCache && (children.memoCache.index = 0);
          }
          ReactSharedInternals.H = HooksDispatcherOnRerender;
          children = Component(props, secondArg);
        } while (didScheduleRenderPhaseUpdateDuringThisPass);
        return children;
      }
      function TransitionAwareHostComponent() {
        var dispatcher = ReactSharedInternals.H, maybeThenable = dispatcher.useState()[0];
        maybeThenable = "function" === typeof maybeThenable.then ? useThenable(maybeThenable) : maybeThenable;
        dispatcher = dispatcher.useState()[0];
        (null !== currentHook ? currentHook.memoizedState : null) !== dispatcher && (currentlyRenderingFiber$1.flags |= 1024);
        return maybeThenable;
      }
      function checkDidRenderIdHook() {
        var didRenderIdHook = 0 !== localIdCounter;
        localIdCounter = 0;
        return didRenderIdHook;
      }
      function bailoutHooks(current, workInProgress2, lanes) {
        workInProgress2.updateQueue = current.updateQueue;
        workInProgress2.flags &= -2053;
        current.lanes &= ~lanes;
      }
      function resetHooksOnUnwind(workInProgress2) {
        if (didScheduleRenderPhaseUpdate) {
          for (workInProgress2 = workInProgress2.memoizedState; null !== workInProgress2; ) {
            var queue = workInProgress2.queue;
            null !== queue && (queue.pending = null);
            workInProgress2 = workInProgress2.next;
          }
          didScheduleRenderPhaseUpdate = false;
        }
        renderLanes = 0;
        workInProgressHook = currentHook = currentlyRenderingFiber$1 = null;
        didScheduleRenderPhaseUpdateDuringThisPass = false;
        thenableIndexCounter = localIdCounter = 0;
        thenableState = null;
      }
      function mountWorkInProgressHook() {
        var hook = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        null === workInProgressHook ? currentlyRenderingFiber$1.memoizedState = workInProgressHook = hook : workInProgressHook = workInProgressHook.next = hook;
        return workInProgressHook;
      }
      function updateWorkInProgressHook() {
        if (null === currentHook) {
          var nextCurrentHook = currentlyRenderingFiber$1.alternate;
          nextCurrentHook = null !== nextCurrentHook ? nextCurrentHook.memoizedState : null;
        } else nextCurrentHook = currentHook.next;
        var nextWorkInProgressHook = null === workInProgressHook ? currentlyRenderingFiber$1.memoizedState : workInProgressHook.next;
        if (null !== nextWorkInProgressHook)
          workInProgressHook = nextWorkInProgressHook, currentHook = nextCurrentHook;
        else {
          if (null === nextCurrentHook) {
            if (null === currentlyRenderingFiber$1.alternate)
              throw Error(formatProdErrorMessage(467));
            throw Error(formatProdErrorMessage(310));
          }
          currentHook = nextCurrentHook;
          nextCurrentHook = {
            memoizedState: currentHook.memoizedState,
            baseState: currentHook.baseState,
            baseQueue: currentHook.baseQueue,
            queue: currentHook.queue,
            next: null
          };
          null === workInProgressHook ? currentlyRenderingFiber$1.memoizedState = workInProgressHook = nextCurrentHook : workInProgressHook = workInProgressHook.next = nextCurrentHook;
        }
        return workInProgressHook;
      }
      var createFunctionComponentUpdateQueue;
      createFunctionComponentUpdateQueue = function() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      };
      function useThenable(thenable) {
        var index2 = thenableIndexCounter;
        thenableIndexCounter += 1;
        null === thenableState && (thenableState = []);
        thenable = trackUsedThenable(thenableState, thenable, index2);
        index2 = currentlyRenderingFiber$1;
        null === (null === workInProgressHook ? index2.memoizedState : workInProgressHook.next) && (index2 = index2.alternate, ReactSharedInternals.H = null === index2 || null === index2.memoizedState ? HooksDispatcherOnMount : HooksDispatcherOnUpdate);
        return thenable;
      }
      function use(usable) {
        if (null !== usable && "object" === typeof usable) {
          if ("function" === typeof usable.then) return useThenable(usable);
          if (usable.$$typeof === REACT_CONTEXT_TYPE) return readContext(usable);
        }
        throw Error(formatProdErrorMessage(438, String(usable)));
      }
      function useMemoCache(size) {
        var memoCache = null, updateQueue = currentlyRenderingFiber$1.updateQueue;
        null !== updateQueue && (memoCache = updateQueue.memoCache);
        if (null == memoCache) {
          var current = currentlyRenderingFiber$1.alternate;
          null !== current && (current = current.updateQueue, null !== current && (current = current.memoCache, null != current && (memoCache = {
            data: current.data.map(function(array) {
              return array.slice();
            }),
            index: 0
          })));
        }
        null == memoCache && (memoCache = { data: [], index: 0 });
        null === updateQueue && (updateQueue = createFunctionComponentUpdateQueue(), currentlyRenderingFiber$1.updateQueue = updateQueue);
        updateQueue.memoCache = memoCache;
        updateQueue = memoCache.data[memoCache.index];
        if (void 0 === updateQueue)
          for (updateQueue = memoCache.data[memoCache.index] = Array(size), current = 0; current < size; current++)
            updateQueue[current] = REACT_MEMO_CACHE_SENTINEL;
        memoCache.index++;
        return updateQueue;
      }
      function basicStateReducer(state, action) {
        return "function" === typeof action ? action(state) : action;
      }
      function updateReducer(reducer) {
        var hook = updateWorkInProgressHook();
        return updateReducerImpl(hook, currentHook, reducer);
      }
      function updateReducerImpl(hook, current, reducer) {
        var queue = hook.queue;
        if (null === queue) throw Error(formatProdErrorMessage(311));
        queue.lastRenderedReducer = reducer;
        var baseQueue = hook.baseQueue, pendingQueue = queue.pending;
        if (null !== pendingQueue) {
          if (null !== baseQueue) {
            var baseFirst = baseQueue.next;
            baseQueue.next = pendingQueue.next;
            pendingQueue.next = baseFirst;
          }
          current.baseQueue = baseQueue = pendingQueue;
          queue.pending = null;
        }
        pendingQueue = hook.baseState;
        if (null === baseQueue) hook.memoizedState = pendingQueue;
        else {
          current = baseQueue.next;
          var newBaseQueueFirst = baseFirst = null, newBaseQueueLast = null, update = current, didReadFromEntangledAsyncAction$54 = false;
          do {
            var updateLane = update.lane & -536870913;
            if (updateLane !== update.lane ? (workInProgressRootRenderLanes & updateLane) === updateLane : (renderLanes & updateLane) === updateLane) {
              var revertLane = update.revertLane;
              if (0 === revertLane)
                null !== newBaseQueueLast && (newBaseQueueLast = newBaseQueueLast.next = {
                  lane: 0,
                  revertLane: 0,
                  action: update.action,
                  hasEagerState: update.hasEagerState,
                  eagerState: update.eagerState,
                  next: null
                }), updateLane === currentEntangledLane && (didReadFromEntangledAsyncAction$54 = true);
              else if ((renderLanes & revertLane) === revertLane) {
                update = update.next;
                revertLane === currentEntangledLane && (didReadFromEntangledAsyncAction$54 = true);
                continue;
              } else
                updateLane = {
                  lane: 0,
                  revertLane: update.revertLane,
                  action: update.action,
                  hasEagerState: update.hasEagerState,
                  eagerState: update.eagerState,
                  next: null
                }, null === newBaseQueueLast ? (newBaseQueueFirst = newBaseQueueLast = updateLane, baseFirst = pendingQueue) : newBaseQueueLast = newBaseQueueLast.next = updateLane, currentlyRenderingFiber$1.lanes |= revertLane, workInProgressRootSkippedLanes |= revertLane;
              updateLane = update.action;
              shouldDoubleInvokeUserFnsInHooksDEV && reducer(pendingQueue, updateLane);
              pendingQueue = update.hasEagerState ? update.eagerState : reducer(pendingQueue, updateLane);
            } else
              revertLane = {
                lane: updateLane,
                revertLane: update.revertLane,
                action: update.action,
                hasEagerState: update.hasEagerState,
                eagerState: update.eagerState,
                next: null
              }, null === newBaseQueueLast ? (newBaseQueueFirst = newBaseQueueLast = revertLane, baseFirst = pendingQueue) : newBaseQueueLast = newBaseQueueLast.next = revertLane, currentlyRenderingFiber$1.lanes |= updateLane, workInProgressRootSkippedLanes |= updateLane;
            update = update.next;
          } while (null !== update && update !== current);
          null === newBaseQueueLast ? baseFirst = pendingQueue : newBaseQueueLast.next = newBaseQueueFirst;
          if (!objectIs(pendingQueue, hook.memoizedState) && (didReceiveUpdate = true, didReadFromEntangledAsyncAction$54 && (reducer = currentEntangledActionThenable, null !== reducer)))
            throw reducer;
          hook.memoizedState = pendingQueue;
          hook.baseState = baseFirst;
          hook.baseQueue = newBaseQueueLast;
          queue.lastRenderedState = pendingQueue;
        }
        null === baseQueue && (queue.lanes = 0);
        return [hook.memoizedState, queue.dispatch];
      }
      function rerenderReducer(reducer) {
        var hook = updateWorkInProgressHook(), queue = hook.queue;
        if (null === queue) throw Error(formatProdErrorMessage(311));
        queue.lastRenderedReducer = reducer;
        var dispatch = queue.dispatch, lastRenderPhaseUpdate = queue.pending, newState = hook.memoizedState;
        if (null !== lastRenderPhaseUpdate) {
          queue.pending = null;
          var update = lastRenderPhaseUpdate = lastRenderPhaseUpdate.next;
          do
            newState = reducer(newState, update.action), update = update.next;
          while (update !== lastRenderPhaseUpdate);
          objectIs(newState, hook.memoizedState) || (didReceiveUpdate = true);
          hook.memoizedState = newState;
          null === hook.baseQueue && (hook.baseState = newState);
          queue.lastRenderedState = newState;
        }
        return [newState, dispatch];
      }
      function updateSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
        var fiber = currentlyRenderingFiber$1, hook = updateWorkInProgressHook(), isHydrating$jscomp$0 = isHydrating;
        if (isHydrating$jscomp$0) {
          if (void 0 === getServerSnapshot) throw Error(formatProdErrorMessage(407));
          getServerSnapshot = getServerSnapshot();
        } else getServerSnapshot = getSnapshot();
        var snapshotChanged = !objectIs(
          (currentHook || hook).memoizedState,
          getServerSnapshot
        );
        snapshotChanged && (hook.memoizedState = getServerSnapshot, didReceiveUpdate = true);
        hook = hook.queue;
        updateEffect(subscribeToStore.bind(null, fiber, hook, subscribe), [
          subscribe
        ]);
        if (hook.getSnapshot !== getSnapshot || snapshotChanged || null !== workInProgressHook && workInProgressHook.memoizedState.tag & 1) {
          fiber.flags |= 2048;
          pushEffect(
            9,
            updateStoreInstance.bind(
              null,
              fiber,
              hook,
              getServerSnapshot,
              getSnapshot
            ),
            { destroy: void 0 },
            null
          );
          if (null === workInProgressRoot) throw Error(formatProdErrorMessage(349));
          isHydrating$jscomp$0 || 0 !== (renderLanes & 60) || pushStoreConsistencyCheck(fiber, getSnapshot, getServerSnapshot);
        }
        return getServerSnapshot;
      }
      function pushStoreConsistencyCheck(fiber, getSnapshot, renderedSnapshot) {
        fiber.flags |= 16384;
        fiber = { getSnapshot, value: renderedSnapshot };
        getSnapshot = currentlyRenderingFiber$1.updateQueue;
        null === getSnapshot ? (getSnapshot = createFunctionComponentUpdateQueue(), currentlyRenderingFiber$1.updateQueue = getSnapshot, getSnapshot.stores = [fiber]) : (renderedSnapshot = getSnapshot.stores, null === renderedSnapshot ? getSnapshot.stores = [fiber] : renderedSnapshot.push(fiber));
      }
      function updateStoreInstance(fiber, inst, nextSnapshot, getSnapshot) {
        inst.value = nextSnapshot;
        inst.getSnapshot = getSnapshot;
        checkIfSnapshotChanged(inst) && forceStoreRerender(fiber);
      }
      function subscribeToStore(fiber, inst, subscribe) {
        return subscribe(function() {
          checkIfSnapshotChanged(inst) && forceStoreRerender(fiber);
        });
      }
      function checkIfSnapshotChanged(inst) {
        var latestGetSnapshot = inst.getSnapshot;
        inst = inst.value;
        try {
          var nextValue = latestGetSnapshot();
          return !objectIs(inst, nextValue);
        } catch (error) {
          return true;
        }
      }
      function forceStoreRerender(fiber) {
        var root2 = enqueueConcurrentRenderForLane(fiber, 2);
        null !== root2 && scheduleUpdateOnFiber(root2, fiber, 2);
      }
      function mountStateImpl(initialState) {
        var hook = mountWorkInProgressHook();
        if ("function" === typeof initialState) {
          var initialStateInitializer = initialState;
          initialState = initialStateInitializer();
          if (shouldDoubleInvokeUserFnsInHooksDEV) {
            setIsStrictModeForDevtools(true);
            try {
              initialStateInitializer();
            } finally {
              setIsStrictModeForDevtools(false);
            }
          }
        }
        hook.memoizedState = hook.baseState = initialState;
        hook.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: basicStateReducer,
          lastRenderedState: initialState
        };
        return hook;
      }
      function updateOptimisticImpl(hook, current, passthrough, reducer) {
        hook.baseState = passthrough;
        return updateReducerImpl(
          hook,
          currentHook,
          "function" === typeof reducer ? reducer : basicStateReducer
        );
      }
      function dispatchActionState(fiber, actionQueue, setPendingState, setState, payload) {
        if (isRenderPhaseUpdate(fiber)) throw Error(formatProdErrorMessage(485));
        fiber = actionQueue.action;
        if (null !== fiber) {
          var actionNode = {
            payload,
            action: fiber,
            next: null,
            isTransition: true,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(listener) {
              actionNode.listeners.push(listener);
            }
          };
          null !== ReactSharedInternals.T ? setPendingState(true) : actionNode.isTransition = false;
          setState(actionNode);
          setPendingState = actionQueue.pending;
          null === setPendingState ? (actionNode.next = actionQueue.pending = actionNode, runActionStateAction(actionQueue, actionNode)) : (actionNode.next = setPendingState.next, actionQueue.pending = setPendingState.next = actionNode);
        }
      }
      function runActionStateAction(actionQueue, node) {
        var action = node.action, payload = node.payload, prevState = actionQueue.state;
        if (node.isTransition) {
          var prevTransition = ReactSharedInternals.T, currentTransition = {};
          ReactSharedInternals.T = currentTransition;
          try {
            var returnValue = action(prevState, payload), onStartTransitionFinish = ReactSharedInternals.S;
            null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
            handleActionReturnValue(actionQueue, node, returnValue);
          } catch (error) {
            onActionError(actionQueue, node, error);
          } finally {
            ReactSharedInternals.T = prevTransition;
          }
        } else
          try {
            prevTransition = action(prevState, payload), handleActionReturnValue(actionQueue, node, prevTransition);
          } catch (error$60) {
            onActionError(actionQueue, node, error$60);
          }
      }
      function handleActionReturnValue(actionQueue, node, returnValue) {
        null !== returnValue && "object" === typeof returnValue && "function" === typeof returnValue.then ? returnValue.then(
          function(nextState) {
            onActionSuccess(actionQueue, node, nextState);
          },
          function(error) {
            return onActionError(actionQueue, node, error);
          }
        ) : onActionSuccess(actionQueue, node, returnValue);
      }
      function onActionSuccess(actionQueue, actionNode, nextState) {
        actionNode.status = "fulfilled";
        actionNode.value = nextState;
        notifyActionListeners(actionNode);
        actionQueue.state = nextState;
        actionNode = actionQueue.pending;
        null !== actionNode && (nextState = actionNode.next, nextState === actionNode ? actionQueue.pending = null : (nextState = nextState.next, actionNode.next = nextState, runActionStateAction(actionQueue, nextState)));
      }
      function onActionError(actionQueue, actionNode, error) {
        var last = actionQueue.pending;
        actionQueue.pending = null;
        if (null !== last) {
          last = last.next;
          do
            actionNode.status = "rejected", actionNode.reason = error, notifyActionListeners(actionNode), actionNode = actionNode.next;
          while (actionNode !== last);
        }
        actionQueue.action = null;
      }
      function notifyActionListeners(actionNode) {
        actionNode = actionNode.listeners;
        for (var i = 0; i < actionNode.length; i++) (0, actionNode[i])();
      }
      function actionStateReducer(oldState, newState) {
        return newState;
      }
      function mountActionState(action, initialStateProp) {
        if (isHydrating) {
          var ssrFormState = workInProgressRoot.formState;
          if (null !== ssrFormState) {
            a: {
              var JSCompiler_inline_result = currentlyRenderingFiber$1;
              if (isHydrating) {
                if (nextHydratableInstance) {
                  b: {
                    var JSCompiler_inline_result$jscomp$0 = nextHydratableInstance;
                    for (var inRootOrSingleton = rootOrSingletonContext; 8 !== JSCompiler_inline_result$jscomp$0.nodeType; ) {
                      if (!inRootOrSingleton) {
                        JSCompiler_inline_result$jscomp$0 = null;
                        break b;
                      }
                      JSCompiler_inline_result$jscomp$0 = getNextHydratable(
                        JSCompiler_inline_result$jscomp$0.nextSibling
                      );
                      if (null === JSCompiler_inline_result$jscomp$0) {
                        JSCompiler_inline_result$jscomp$0 = null;
                        break b;
                      }
                    }
                    inRootOrSingleton = JSCompiler_inline_result$jscomp$0.data;
                    JSCompiler_inline_result$jscomp$0 = "F!" === inRootOrSingleton || "F" === inRootOrSingleton ? JSCompiler_inline_result$jscomp$0 : null;
                  }
                  if (JSCompiler_inline_result$jscomp$0) {
                    nextHydratableInstance = getNextHydratable(
                      JSCompiler_inline_result$jscomp$0.nextSibling
                    );
                    JSCompiler_inline_result = "F!" === JSCompiler_inline_result$jscomp$0.data;
                    break a;
                  }
                }
                throwOnHydrationMismatch(JSCompiler_inline_result);
              }
              JSCompiler_inline_result = false;
            }
            JSCompiler_inline_result && (initialStateProp = ssrFormState[0]);
          }
        }
        ssrFormState = mountWorkInProgressHook();
        ssrFormState.memoizedState = ssrFormState.baseState = initialStateProp;
        JSCompiler_inline_result = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: actionStateReducer,
          lastRenderedState: initialStateProp
        };
        ssrFormState.queue = JSCompiler_inline_result;
        ssrFormState = dispatchSetState.bind(
          null,
          currentlyRenderingFiber$1,
          JSCompiler_inline_result
        );
        JSCompiler_inline_result.dispatch = ssrFormState;
        JSCompiler_inline_result = mountStateImpl(false);
        inRootOrSingleton = dispatchOptimisticSetState.bind(
          null,
          currentlyRenderingFiber$1,
          false,
          JSCompiler_inline_result.queue
        );
        JSCompiler_inline_result = mountWorkInProgressHook();
        JSCompiler_inline_result$jscomp$0 = {
          state: initialStateProp,
          dispatch: null,
          action,
          pending: null
        };
        JSCompiler_inline_result.queue = JSCompiler_inline_result$jscomp$0;
        ssrFormState = dispatchActionState.bind(
          null,
          currentlyRenderingFiber$1,
          JSCompiler_inline_result$jscomp$0,
          inRootOrSingleton,
          ssrFormState
        );
        JSCompiler_inline_result$jscomp$0.dispatch = ssrFormState;
        JSCompiler_inline_result.memoizedState = action;
        return [initialStateProp, ssrFormState, false];
      }
      function updateActionState(action) {
        var stateHook = updateWorkInProgressHook();
        return updateActionStateImpl(stateHook, currentHook, action);
      }
      function updateActionStateImpl(stateHook, currentStateHook, action) {
        currentStateHook = updateReducerImpl(
          stateHook,
          currentStateHook,
          actionStateReducer
        )[0];
        stateHook = updateReducer(basicStateReducer)[0];
        currentStateHook = "object" === typeof currentStateHook && null !== currentStateHook && "function" === typeof currentStateHook.then ? useThenable(currentStateHook) : currentStateHook;
        var actionQueueHook = updateWorkInProgressHook(), actionQueue = actionQueueHook.queue, dispatch = actionQueue.dispatch;
        action !== actionQueueHook.memoizedState && (currentlyRenderingFiber$1.flags |= 2048, pushEffect(
          9,
          actionStateActionEffect.bind(null, actionQueue, action),
          { destroy: void 0 },
          null
        ));
        return [currentStateHook, dispatch, stateHook];
      }
      function actionStateActionEffect(actionQueue, action) {
        actionQueue.action = action;
      }
      function rerenderActionState(action) {
        var stateHook = updateWorkInProgressHook(), currentStateHook = currentHook;
        if (null !== currentStateHook)
          return updateActionStateImpl(stateHook, currentStateHook, action);
        updateWorkInProgressHook();
        stateHook = stateHook.memoizedState;
        currentStateHook = updateWorkInProgressHook();
        var dispatch = currentStateHook.queue.dispatch;
        currentStateHook.memoizedState = action;
        return [stateHook, dispatch, false];
      }
      function pushEffect(tag, create, inst, deps) {
        tag = { tag, create, inst, deps, next: null };
        create = currentlyRenderingFiber$1.updateQueue;
        null === create && (create = createFunctionComponentUpdateQueue(), currentlyRenderingFiber$1.updateQueue = create);
        inst = create.lastEffect;
        null === inst ? create.lastEffect = tag.next = tag : (deps = inst.next, inst.next = tag, tag.next = deps, create.lastEffect = tag);
        return tag;
      }
      function updateRef() {
        return updateWorkInProgressHook().memoizedState;
      }
      function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
        var hook = mountWorkInProgressHook();
        currentlyRenderingFiber$1.flags |= fiberFlags;
        hook.memoizedState = pushEffect(
          1 | hookFlags,
          create,
          { destroy: void 0 },
          void 0 === deps ? null : deps
        );
      }
      function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
        var hook = updateWorkInProgressHook();
        deps = void 0 === deps ? null : deps;
        var inst = hook.memoizedState.inst;
        null !== currentHook && null !== deps && areHookInputsEqual(deps, currentHook.memoizedState.deps) ? hook.memoizedState = pushEffect(hookFlags, create, inst, deps) : (currentlyRenderingFiber$1.flags |= fiberFlags, hook.memoizedState = pushEffect(1 | hookFlags, create, inst, deps));
      }
      function mountEffect(create, deps) {
        mountEffectImpl(8390656, 8, create, deps);
      }
      function updateEffect(create, deps) {
        updateEffectImpl(2048, 8, create, deps);
      }
      function updateInsertionEffect(create, deps) {
        return updateEffectImpl(4, 2, create, deps);
      }
      function updateLayoutEffect(create, deps) {
        return updateEffectImpl(4, 4, create, deps);
      }
      function imperativeHandleEffect(create, ref) {
        if ("function" === typeof ref) {
          create = create();
          var refCleanup = ref(create);
          return function() {
            "function" === typeof refCleanup ? refCleanup() : ref(null);
          };
        }
        if (null !== ref && void 0 !== ref)
          return create = create(), ref.current = create, function() {
            ref.current = null;
          };
      }
      function updateImperativeHandle(ref, create, deps) {
        deps = null !== deps && void 0 !== deps ? deps.concat([ref]) : null;
        updateEffectImpl(4, 4, imperativeHandleEffect.bind(null, create, ref), deps);
      }
      function mountDebugValue() {
      }
      function updateCallback(callback, deps) {
        var hook = updateWorkInProgressHook();
        deps = void 0 === deps ? null : deps;
        var prevState = hook.memoizedState;
        if (null !== deps && areHookInputsEqual(deps, prevState[1]))
          return prevState[0];
        hook.memoizedState = [callback, deps];
        return callback;
      }
      function updateMemo(nextCreate, deps) {
        var hook = updateWorkInProgressHook();
        deps = void 0 === deps ? null : deps;
        var prevState = hook.memoizedState;
        if (null !== deps && areHookInputsEqual(deps, prevState[1]))
          return prevState[0];
        prevState = nextCreate();
        if (shouldDoubleInvokeUserFnsInHooksDEV) {
          setIsStrictModeForDevtools(true);
          try {
            nextCreate();
          } finally {
            setIsStrictModeForDevtools(false);
          }
        }
        hook.memoizedState = [prevState, deps];
        return prevState;
      }
      function mountDeferredValueImpl(hook, value, initialValue) {
        if (void 0 === initialValue || 0 !== (renderLanes & 1073741824))
          return hook.memoizedState = value;
        hook.memoizedState = initialValue;
        hook = requestDeferredLane();
        currentlyRenderingFiber$1.lanes |= hook;
        workInProgressRootSkippedLanes |= hook;
        return initialValue;
      }
      function updateDeferredValueImpl(hook, prevValue, value, initialValue) {
        if (objectIs(value, prevValue)) return value;
        if (null !== currentTreeHiddenStackCursor.current)
          return hook = mountDeferredValueImpl(hook, value, initialValue), objectIs(hook, prevValue) || (didReceiveUpdate = true), hook;
        if (0 === (renderLanes & 42))
          return didReceiveUpdate = true, hook.memoizedState = value;
        hook = requestDeferredLane();
        currentlyRenderingFiber$1.lanes |= hook;
        workInProgressRootSkippedLanes |= hook;
        return prevValue;
      }
      function startTransition(fiber, queue, pendingState, finishedState, callback) {
        var previousPriority = ReactDOMSharedInternals.p;
        ReactDOMSharedInternals.p = 0 !== previousPriority && 8 > previousPriority ? previousPriority : 8;
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        ReactSharedInternals.T = currentTransition;
        dispatchOptimisticSetState(fiber, false, queue, pendingState);
        try {
          var returnValue = callback(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          if (null !== returnValue && "object" === typeof returnValue && "function" === typeof returnValue.then) {
            var thenableForFinishedState = chainThenableValue(
              returnValue,
              finishedState
            );
            dispatchSetStateInternal(
              fiber,
              queue,
              thenableForFinishedState,
              requestUpdateLane(fiber)
            );
          } else
            dispatchSetStateInternal(
              fiber,
              queue,
              finishedState,
              requestUpdateLane(fiber)
            );
        } catch (error) {
          dispatchSetStateInternal(
            fiber,
            queue,
            { then: function() {
            }, status: "rejected", reason: error },
            requestUpdateLane()
          );
        } finally {
          ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
        }
      }
      function noop$2() {
      }
      function startHostTransition(formFiber, pendingState, action, formData) {
        if (5 !== formFiber.tag) throw Error(formatProdErrorMessage(476));
        var queue = ensureFormComponentIsStateful(formFiber).queue;
        startTransition(
          formFiber,
          queue,
          pendingState,
          sharedNotPendingObject,
          null === action ? noop$2 : function() {
            requestFormReset$1(formFiber);
            return action(formData);
          }
        );
      }
      function ensureFormComponentIsStateful(formFiber) {
        var existingStateHook = formFiber.memoizedState;
        if (null !== existingStateHook) return existingStateHook;
        existingStateHook = {
          memoizedState: sharedNotPendingObject,
          baseState: sharedNotPendingObject,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: basicStateReducer,
            lastRenderedState: sharedNotPendingObject
          },
          next: null
        };
        var initialResetState = {};
        existingStateHook.next = {
          memoizedState: initialResetState,
          baseState: initialResetState,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: basicStateReducer,
            lastRenderedState: initialResetState
          },
          next: null
        };
        formFiber.memoizedState = existingStateHook;
        formFiber = formFiber.alternate;
        null !== formFiber && (formFiber.memoizedState = existingStateHook);
        return existingStateHook;
      }
      function requestFormReset$1(formFiber) {
        var resetStateQueue = ensureFormComponentIsStateful(formFiber).next.queue;
        dispatchSetStateInternal(formFiber, resetStateQueue, {}, requestUpdateLane());
      }
      function useHostTransitionStatus() {
        return readContext(HostTransitionContext);
      }
      function updateId() {
        return updateWorkInProgressHook().memoizedState;
      }
      function updateRefresh() {
        return updateWorkInProgressHook().memoizedState;
      }
      function refreshCache(fiber) {
        for (var provider = fiber.return; null !== provider; ) {
          switch (provider.tag) {
            case 24:
            case 3:
              var lane = requestUpdateLane();
              fiber = createUpdate(lane);
              var root$63 = enqueueUpdate(provider, fiber, lane);
              null !== root$63 && (scheduleUpdateOnFiber(root$63, provider, lane), entangleTransitions(root$63, provider, lane));
              provider = { cache: createCache() };
              fiber.payload = provider;
              return;
          }
          provider = provider.return;
        }
      }
      function dispatchReducerAction(fiber, queue, action) {
        var lane = requestUpdateLane();
        action = {
          lane,
          revertLane: 0,
          action,
          hasEagerState: false,
          eagerState: null,
          next: null
        };
        isRenderPhaseUpdate(fiber) ? enqueueRenderPhaseUpdate(queue, action) : (action = enqueueConcurrentHookUpdate(fiber, queue, action, lane), null !== action && (scheduleUpdateOnFiber(action, fiber, lane), entangleTransitionUpdate(action, queue, lane)));
      }
      function dispatchSetState(fiber, queue, action) {
        var lane = requestUpdateLane();
        dispatchSetStateInternal(fiber, queue, action, lane);
      }
      function dispatchSetStateInternal(fiber, queue, action, lane) {
        var update = {
          lane,
          revertLane: 0,
          action,
          hasEagerState: false,
          eagerState: null,
          next: null
        };
        if (isRenderPhaseUpdate(fiber)) enqueueRenderPhaseUpdate(queue, update);
        else {
          var alternate = fiber.alternate;
          if (0 === fiber.lanes && (null === alternate || 0 === alternate.lanes) && (alternate = queue.lastRenderedReducer, null !== alternate))
            try {
              var currentState = queue.lastRenderedState, eagerState = alternate(currentState, action);
              update.hasEagerState = true;
              update.eagerState = eagerState;
              if (objectIs(eagerState, currentState))
                return enqueueUpdate$1(fiber, queue, update, 0), null === workInProgressRoot && finishQueueingConcurrentUpdates(), false;
            } catch (error) {
            } finally {
            }
          action = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
          if (null !== action)
            return scheduleUpdateOnFiber(action, fiber, lane), entangleTransitionUpdate(action, queue, lane), true;
        }
        return false;
      }
      function dispatchOptimisticSetState(fiber, throwIfDuringRender, queue, action) {
        action = {
          lane: 2,
          revertLane: requestTransitionLane(),
          action,
          hasEagerState: false,
          eagerState: null,
          next: null
        };
        if (isRenderPhaseUpdate(fiber)) {
          if (throwIfDuringRender) throw Error(formatProdErrorMessage(479));
        } else
          throwIfDuringRender = enqueueConcurrentHookUpdate(
            fiber,
            queue,
            action,
            2
          ), null !== throwIfDuringRender && scheduleUpdateOnFiber(throwIfDuringRender, fiber, 2);
      }
      function isRenderPhaseUpdate(fiber) {
        var alternate = fiber.alternate;
        return fiber === currentlyRenderingFiber$1 || null !== alternate && alternate === currentlyRenderingFiber$1;
      }
      function enqueueRenderPhaseUpdate(queue, update) {
        didScheduleRenderPhaseUpdateDuringThisPass = didScheduleRenderPhaseUpdate = true;
        var pending = queue.pending;
        null === pending ? update.next = update : (update.next = pending.next, pending.next = update);
        queue.pending = update;
      }
      function entangleTransitionUpdate(root2, queue, lane) {
        if (0 !== (lane & 4194176)) {
          var queueLanes = queue.lanes;
          queueLanes &= root2.pendingLanes;
          lane |= queueLanes;
          queue.lanes = lane;
          markRootEntangled(root2, lane);
        }
      }
      var ContextOnlyDispatcher = {
        readContext,
        use,
        useCallback: throwInvalidHookError,
        useContext: throwInvalidHookError,
        useEffect: throwInvalidHookError,
        useImperativeHandle: throwInvalidHookError,
        useLayoutEffect: throwInvalidHookError,
        useInsertionEffect: throwInvalidHookError,
        useMemo: throwInvalidHookError,
        useReducer: throwInvalidHookError,
        useRef: throwInvalidHookError,
        useState: throwInvalidHookError,
        useDebugValue: throwInvalidHookError,
        useDeferredValue: throwInvalidHookError,
        useTransition: throwInvalidHookError,
        useSyncExternalStore: throwInvalidHookError,
        useId: throwInvalidHookError
      };
      ContextOnlyDispatcher.useCacheRefresh = throwInvalidHookError;
      ContextOnlyDispatcher.useMemoCache = throwInvalidHookError;
      ContextOnlyDispatcher.useHostTransitionStatus = throwInvalidHookError;
      ContextOnlyDispatcher.useFormState = throwInvalidHookError;
      ContextOnlyDispatcher.useActionState = throwInvalidHookError;
      ContextOnlyDispatcher.useOptimistic = throwInvalidHookError;
      var HooksDispatcherOnMount = {
        readContext,
        use,
        useCallback: function(callback, deps) {
          mountWorkInProgressHook().memoizedState = [
            callback,
            void 0 === deps ? null : deps
          ];
          return callback;
        },
        useContext: readContext,
        useEffect: mountEffect,
        useImperativeHandle: function(ref, create, deps) {
          deps = null !== deps && void 0 !== deps ? deps.concat([ref]) : null;
          mountEffectImpl(
            4194308,
            4,
            imperativeHandleEffect.bind(null, create, ref),
            deps
          );
        },
        useLayoutEffect: function(create, deps) {
          return mountEffectImpl(4194308, 4, create, deps);
        },
        useInsertionEffect: function(create, deps) {
          mountEffectImpl(4, 2, create, deps);
        },
        useMemo: function(nextCreate, deps) {
          var hook = mountWorkInProgressHook();
          deps = void 0 === deps ? null : deps;
          var nextValue = nextCreate();
          if (shouldDoubleInvokeUserFnsInHooksDEV) {
            setIsStrictModeForDevtools(true);
            try {
              nextCreate();
            } finally {
              setIsStrictModeForDevtools(false);
            }
          }
          hook.memoizedState = [nextValue, deps];
          return nextValue;
        },
        useReducer: function(reducer, initialArg, init) {
          var hook = mountWorkInProgressHook();
          if (void 0 !== init) {
            var initialState = init(initialArg);
            if (shouldDoubleInvokeUserFnsInHooksDEV) {
              setIsStrictModeForDevtools(true);
              try {
                init(initialArg);
              } finally {
                setIsStrictModeForDevtools(false);
              }
            }
          } else initialState = initialArg;
          hook.memoizedState = hook.baseState = initialState;
          reducer = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: reducer,
            lastRenderedState: initialState
          };
          hook.queue = reducer;
          reducer = reducer.dispatch = dispatchReducerAction.bind(
            null,
            currentlyRenderingFiber$1,
            reducer
          );
          return [hook.memoizedState, reducer];
        },
        useRef: function(initialValue) {
          var hook = mountWorkInProgressHook();
          initialValue = { current: initialValue };
          return hook.memoizedState = initialValue;
        },
        useState: function(initialState) {
          initialState = mountStateImpl(initialState);
          var queue = initialState.queue, dispatch = dispatchSetState.bind(null, currentlyRenderingFiber$1, queue);
          queue.dispatch = dispatch;
          return [initialState.memoizedState, dispatch];
        },
        useDebugValue: mountDebugValue,
        useDeferredValue: function(value, initialValue) {
          var hook = mountWorkInProgressHook();
          return mountDeferredValueImpl(hook, value, initialValue);
        },
        useTransition: function() {
          var stateHook = mountStateImpl(false);
          stateHook = startTransition.bind(
            null,
            currentlyRenderingFiber$1,
            stateHook.queue,
            true,
            false
          );
          mountWorkInProgressHook().memoizedState = stateHook;
          return [false, stateHook];
        },
        useSyncExternalStore: function(subscribe, getSnapshot, getServerSnapshot) {
          var fiber = currentlyRenderingFiber$1, hook = mountWorkInProgressHook();
          if (isHydrating) {
            if (void 0 === getServerSnapshot)
              throw Error(formatProdErrorMessage(407));
            getServerSnapshot = getServerSnapshot();
          } else {
            getServerSnapshot = getSnapshot();
            if (null === workInProgressRoot) throw Error(formatProdErrorMessage(349));
            0 !== (workInProgressRootRenderLanes & 60) || pushStoreConsistencyCheck(fiber, getSnapshot, getServerSnapshot);
          }
          hook.memoizedState = getServerSnapshot;
          var inst = { value: getServerSnapshot, getSnapshot };
          hook.queue = inst;
          mountEffect(subscribeToStore.bind(null, fiber, inst, subscribe), [
            subscribe
          ]);
          fiber.flags |= 2048;
          pushEffect(
            9,
            updateStoreInstance.bind(
              null,
              fiber,
              inst,
              getServerSnapshot,
              getSnapshot
            ),
            { destroy: void 0 },
            null
          );
          return getServerSnapshot;
        },
        useId: function() {
          var hook = mountWorkInProgressHook(), identifierPrefix = workInProgressRoot.identifierPrefix;
          if (isHydrating) {
            var JSCompiler_inline_result = treeContextOverflow;
            var idWithLeadingBit = treeContextId;
            JSCompiler_inline_result = (idWithLeadingBit & ~(1 << 32 - clz32(idWithLeadingBit) - 1)).toString(32) + JSCompiler_inline_result;
            identifierPrefix = ":" + identifierPrefix + "R" + JSCompiler_inline_result;
            JSCompiler_inline_result = localIdCounter++;
            0 < JSCompiler_inline_result && (identifierPrefix += "H" + JSCompiler_inline_result.toString(32));
            identifierPrefix += ":";
          } else
            JSCompiler_inline_result = globalClientIdCounter++, identifierPrefix = ":" + identifierPrefix + "r" + JSCompiler_inline_result.toString(32) + ":";
          return hook.memoizedState = identifierPrefix;
        },
        useCacheRefresh: function() {
          return mountWorkInProgressHook().memoizedState = refreshCache.bind(
            null,
            currentlyRenderingFiber$1
          );
        }
      };
      HooksDispatcherOnMount.useMemoCache = useMemoCache;
      HooksDispatcherOnMount.useHostTransitionStatus = useHostTransitionStatus;
      HooksDispatcherOnMount.useFormState = mountActionState;
      HooksDispatcherOnMount.useActionState = mountActionState;
      HooksDispatcherOnMount.useOptimistic = function(passthrough) {
        var hook = mountWorkInProgressHook();
        hook.memoizedState = hook.baseState = passthrough;
        var queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: null,
          lastRenderedState: null
        };
        hook.queue = queue;
        hook = dispatchOptimisticSetState.bind(
          null,
          currentlyRenderingFiber$1,
          true,
          queue
        );
        queue.dispatch = hook;
        return [passthrough, hook];
      };
      var HooksDispatcherOnUpdate = {
        readContext,
        use,
        useCallback: updateCallback,
        useContext: readContext,
        useEffect: updateEffect,
        useImperativeHandle: updateImperativeHandle,
        useInsertionEffect: updateInsertionEffect,
        useLayoutEffect: updateLayoutEffect,
        useMemo: updateMemo,
        useReducer: updateReducer,
        useRef: updateRef,
        useState: function() {
          return updateReducer(basicStateReducer);
        },
        useDebugValue: mountDebugValue,
        useDeferredValue: function(value, initialValue) {
          var hook = updateWorkInProgressHook();
          return updateDeferredValueImpl(
            hook,
            currentHook.memoizedState,
            value,
            initialValue
          );
        },
        useTransition: function() {
          var booleanOrThenable = updateReducer(basicStateReducer)[0], start = updateWorkInProgressHook().memoizedState;
          return [
            "boolean" === typeof booleanOrThenable ? booleanOrThenable : useThenable(booleanOrThenable),
            start
          ];
        },
        useSyncExternalStore: updateSyncExternalStore,
        useId: updateId
      };
      HooksDispatcherOnUpdate.useCacheRefresh = updateRefresh;
      HooksDispatcherOnUpdate.useMemoCache = useMemoCache;
      HooksDispatcherOnUpdate.useHostTransitionStatus = useHostTransitionStatus;
      HooksDispatcherOnUpdate.useFormState = updateActionState;
      HooksDispatcherOnUpdate.useActionState = updateActionState;
      HooksDispatcherOnUpdate.useOptimistic = function(passthrough, reducer) {
        var hook = updateWorkInProgressHook();
        return updateOptimisticImpl(hook, currentHook, passthrough, reducer);
      };
      var HooksDispatcherOnRerender = {
        readContext,
        use,
        useCallback: updateCallback,
        useContext: readContext,
        useEffect: updateEffect,
        useImperativeHandle: updateImperativeHandle,
        useInsertionEffect: updateInsertionEffect,
        useLayoutEffect: updateLayoutEffect,
        useMemo: updateMemo,
        useReducer: rerenderReducer,
        useRef: updateRef,
        useState: function() {
          return rerenderReducer(basicStateReducer);
        },
        useDebugValue: mountDebugValue,
        useDeferredValue: function(value, initialValue) {
          var hook = updateWorkInProgressHook();
          return null === currentHook ? mountDeferredValueImpl(hook, value, initialValue) : updateDeferredValueImpl(
            hook,
            currentHook.memoizedState,
            value,
            initialValue
          );
        },
        useTransition: function() {
          var booleanOrThenable = rerenderReducer(basicStateReducer)[0], start = updateWorkInProgressHook().memoizedState;
          return [
            "boolean" === typeof booleanOrThenable ? booleanOrThenable : useThenable(booleanOrThenable),
            start
          ];
        },
        useSyncExternalStore: updateSyncExternalStore,
        useId: updateId
      };
      HooksDispatcherOnRerender.useCacheRefresh = updateRefresh;
      HooksDispatcherOnRerender.useMemoCache = useMemoCache;
      HooksDispatcherOnRerender.useHostTransitionStatus = useHostTransitionStatus;
      HooksDispatcherOnRerender.useFormState = rerenderActionState;
      HooksDispatcherOnRerender.useActionState = rerenderActionState;
      HooksDispatcherOnRerender.useOptimistic = function(passthrough, reducer) {
        var hook = updateWorkInProgressHook();
        if (null !== currentHook)
          return updateOptimisticImpl(hook, currentHook, passthrough, reducer);
        hook.baseState = passthrough;
        return [passthrough, hook.queue.dispatch];
      };
      function applyDerivedStateFromProps(workInProgress2, ctor, getDerivedStateFromProps, nextProps) {
        ctor = workInProgress2.memoizedState;
        getDerivedStateFromProps = getDerivedStateFromProps(nextProps, ctor);
        getDerivedStateFromProps = null === getDerivedStateFromProps || void 0 === getDerivedStateFromProps ? ctor : assign({}, ctor, getDerivedStateFromProps);
        workInProgress2.memoizedState = getDerivedStateFromProps;
        0 === workInProgress2.lanes && (workInProgress2.updateQueue.baseState = getDerivedStateFromProps);
      }
      var classComponentUpdater = {
        isMounted: function(component) {
          return (component = component._reactInternals) ? getNearestMountedFiber(component) === component : false;
        },
        enqueueSetState: function(inst, payload, callback) {
          inst = inst._reactInternals;
          var lane = requestUpdateLane(), update = createUpdate(lane);
          update.payload = payload;
          void 0 !== callback && null !== callback && (update.callback = callback);
          payload = enqueueUpdate(inst, update, lane);
          null !== payload && (scheduleUpdateOnFiber(payload, inst, lane), entangleTransitions(payload, inst, lane));
        },
        enqueueReplaceState: function(inst, payload, callback) {
          inst = inst._reactInternals;
          var lane = requestUpdateLane(), update = createUpdate(lane);
          update.tag = 1;
          update.payload = payload;
          void 0 !== callback && null !== callback && (update.callback = callback);
          payload = enqueueUpdate(inst, update, lane);
          null !== payload && (scheduleUpdateOnFiber(payload, inst, lane), entangleTransitions(payload, inst, lane));
        },
        enqueueForceUpdate: function(inst, callback) {
          inst = inst._reactInternals;
          var lane = requestUpdateLane(), update = createUpdate(lane);
          update.tag = 2;
          void 0 !== callback && null !== callback && (update.callback = callback);
          callback = enqueueUpdate(inst, update, lane);
          null !== callback && (scheduleUpdateOnFiber(callback, inst, lane), entangleTransitions(callback, inst, lane));
        }
      };
      function checkShouldComponentUpdate(workInProgress2, ctor, oldProps, newProps, oldState, newState, nextContext) {
        workInProgress2 = workInProgress2.stateNode;
        return "function" === typeof workInProgress2.shouldComponentUpdate ? workInProgress2.shouldComponentUpdate(newProps, newState, nextContext) : ctor.prototype && ctor.prototype.isPureReactComponent ? !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState) : true;
      }
      function callComponentWillReceiveProps(workInProgress2, instance, newProps, nextContext) {
        workInProgress2 = instance.state;
        "function" === typeof instance.componentWillReceiveProps && instance.componentWillReceiveProps(newProps, nextContext);
        "function" === typeof instance.UNSAFE_componentWillReceiveProps && instance.UNSAFE_componentWillReceiveProps(newProps, nextContext);
        instance.state !== workInProgress2 && classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
      }
      function resolveClassComponentProps(Component, baseProps) {
        var newProps = baseProps;
        if ("ref" in baseProps) {
          newProps = {};
          for (var propName in baseProps)
            "ref" !== propName && (newProps[propName] = baseProps[propName]);
        }
        if (Component = Component.defaultProps) {
          newProps === baseProps && (newProps = assign({}, newProps));
          for (var propName$67 in Component)
            void 0 === newProps[propName$67] && (newProps[propName$67] = Component[propName$67]);
        }
        return newProps;
      }
      var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      };
      function defaultOnUncaughtError(error) {
        reportGlobalError(error);
      }
      function defaultOnCaughtError(error) {
        console.error(error);
      }
      function defaultOnRecoverableError(error) {
        reportGlobalError(error);
      }
      function logUncaughtError(root2, errorInfo) {
        try {
          var onUncaughtError = root2.onUncaughtError;
          onUncaughtError(errorInfo.value, { componentStack: errorInfo.stack });
        } catch (e$68) {
          setTimeout(function() {
            throw e$68;
          });
        }
      }
      function logCaughtError(root2, boundary, errorInfo) {
        try {
          var onCaughtError = root2.onCaughtError;
          onCaughtError(errorInfo.value, {
            componentStack: errorInfo.stack,
            errorBoundary: 1 === boundary.tag ? boundary.stateNode : null
          });
        } catch (e$69) {
          setTimeout(function() {
            throw e$69;
          });
        }
      }
      function createRootErrorUpdate(root2, errorInfo, lane) {
        lane = createUpdate(lane);
        lane.tag = 3;
        lane.payload = { element: null };
        lane.callback = function() {
          logUncaughtError(root2, errorInfo);
        };
        return lane;
      }
      function createClassErrorUpdate(lane) {
        lane = createUpdate(lane);
        lane.tag = 3;
        return lane;
      }
      function initializeClassErrorUpdate(update, root2, fiber, errorInfo) {
        var getDerivedStateFromError = fiber.type.getDerivedStateFromError;
        if ("function" === typeof getDerivedStateFromError) {
          var error = errorInfo.value;
          update.payload = function() {
            return getDerivedStateFromError(error);
          };
          update.callback = function() {
            logCaughtError(root2, fiber, errorInfo);
          };
        }
        var inst = fiber.stateNode;
        null !== inst && "function" === typeof inst.componentDidCatch && (update.callback = function() {
          logCaughtError(root2, fiber, errorInfo);
          "function" !== typeof getDerivedStateFromError && (null === legacyErrorBoundariesThatAlreadyFailed ? legacyErrorBoundariesThatAlreadyFailed = /* @__PURE__ */ new Set([this]) : legacyErrorBoundariesThatAlreadyFailed.add(this));
          var stack = errorInfo.stack;
          this.componentDidCatch(errorInfo.value, {
            componentStack: null !== stack ? stack : ""
          });
        });
      }
      function throwException(root2, returnFiber, sourceFiber, value, rootRenderLanes) {
        sourceFiber.flags |= 32768;
        if (null !== value && "object" === typeof value && "function" === typeof value.then) {
          returnFiber = sourceFiber.alternate;
          null !== returnFiber && propagateParentContextChanges(
            returnFiber,
            sourceFiber,
            rootRenderLanes,
            true
          );
          sourceFiber = suspenseHandlerStackCursor.current;
          if (null !== sourceFiber) {
            switch (sourceFiber.tag) {
              case 13:
                return null === shellBoundary ? renderDidSuspendDelayIfPossible() : null === sourceFiber.alternate && 0 === workInProgressRootExitStatus && (workInProgressRootExitStatus = 3), sourceFiber.flags &= -257, sourceFiber.flags |= 65536, sourceFiber.lanes = rootRenderLanes, value === noopSuspenseyCommitThenable ? sourceFiber.flags |= 16384 : (returnFiber = sourceFiber.updateQueue, null === returnFiber ? sourceFiber.updateQueue = /* @__PURE__ */ new Set([value]) : returnFiber.add(value), attachPingListener(root2, value, rootRenderLanes)), false;
              case 22:
                return sourceFiber.flags |= 65536, value === noopSuspenseyCommitThenable ? sourceFiber.flags |= 16384 : (returnFiber = sourceFiber.updateQueue, null === returnFiber ? (returnFiber = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([value])
                }, sourceFiber.updateQueue = returnFiber) : (sourceFiber = returnFiber.retryQueue, null === sourceFiber ? returnFiber.retryQueue = /* @__PURE__ */ new Set([value]) : sourceFiber.add(value)), attachPingListener(root2, value, rootRenderLanes)), false;
            }
            throw Error(formatProdErrorMessage(435, sourceFiber.tag));
          }
          attachPingListener(root2, value, rootRenderLanes);
          renderDidSuspendDelayIfPossible();
          return false;
        }
        if (isHydrating)
          return returnFiber = suspenseHandlerStackCursor.current, null !== returnFiber ? (0 === (returnFiber.flags & 65536) && (returnFiber.flags |= 256), returnFiber.flags |= 65536, returnFiber.lanes = rootRenderLanes, value !== HydrationMismatchException && (root2 = Error(formatProdErrorMessage(422), { cause: value }), queueHydrationError(createCapturedValueAtFiber(root2, sourceFiber)))) : (value !== HydrationMismatchException && (returnFiber = Error(formatProdErrorMessage(423), {
            cause: value
          }), queueHydrationError(
            createCapturedValueAtFiber(returnFiber, sourceFiber)
          )), root2 = root2.current.alternate, root2.flags |= 65536, rootRenderLanes &= -rootRenderLanes, root2.lanes |= rootRenderLanes, value = createCapturedValueAtFiber(value, sourceFiber), rootRenderLanes = createRootErrorUpdate(
            root2.stateNode,
            value,
            rootRenderLanes
          ), enqueueCapturedUpdate(root2, rootRenderLanes), 4 !== workInProgressRootExitStatus && (workInProgressRootExitStatus = 2)), false;
        var wrapperError = Error(formatProdErrorMessage(520), { cause: value });
        wrapperError = createCapturedValueAtFiber(wrapperError, sourceFiber);
        null === workInProgressRootConcurrentErrors ? workInProgressRootConcurrentErrors = [wrapperError] : workInProgressRootConcurrentErrors.push(wrapperError);
        4 !== workInProgressRootExitStatus && (workInProgressRootExitStatus = 2);
        if (null === returnFiber) return true;
        value = createCapturedValueAtFiber(value, sourceFiber);
        sourceFiber = returnFiber;
        do {
          switch (sourceFiber.tag) {
            case 3:
              return sourceFiber.flags |= 65536, root2 = rootRenderLanes & -rootRenderLanes, sourceFiber.lanes |= root2, root2 = createRootErrorUpdate(sourceFiber.stateNode, value, root2), enqueueCapturedUpdate(sourceFiber, root2), false;
            case 1:
              if (returnFiber = sourceFiber.type, wrapperError = sourceFiber.stateNode, 0 === (sourceFiber.flags & 128) && ("function" === typeof returnFiber.getDerivedStateFromError || null !== wrapperError && "function" === typeof wrapperError.componentDidCatch && (null === legacyErrorBoundariesThatAlreadyFailed || !legacyErrorBoundariesThatAlreadyFailed.has(wrapperError))))
                return sourceFiber.flags |= 65536, rootRenderLanes &= -rootRenderLanes, sourceFiber.lanes |= rootRenderLanes, rootRenderLanes = createClassErrorUpdate(rootRenderLanes), initializeClassErrorUpdate(
                  rootRenderLanes,
                  root2,
                  sourceFiber,
                  value
                ), enqueueCapturedUpdate(sourceFiber, rootRenderLanes), false;
          }
          sourceFiber = sourceFiber.return;
        } while (null !== sourceFiber);
        return false;
      }
      var SelectiveHydrationException = Error(formatProdErrorMessage(461));
      var didReceiveUpdate = false;
      function reconcileChildren(current, workInProgress2, nextChildren, renderLanes2) {
        workInProgress2.child = null === current ? mountChildFibers(workInProgress2, null, nextChildren, renderLanes2) : reconcileChildFibers(
          workInProgress2,
          current.child,
          nextChildren,
          renderLanes2
        );
      }
      function updateForwardRef(current, workInProgress2, Component, nextProps, renderLanes2) {
        Component = Component.render;
        var ref = workInProgress2.ref;
        if ("ref" in nextProps) {
          var propsWithoutRef = {};
          for (var key in nextProps)
            "ref" !== key && (propsWithoutRef[key] = nextProps[key]);
        } else propsWithoutRef = nextProps;
        prepareToReadContext(workInProgress2);
        nextProps = renderWithHooks(
          current,
          workInProgress2,
          Component,
          propsWithoutRef,
          ref,
          renderLanes2
        );
        key = checkDidRenderIdHook();
        if (null !== current && !didReceiveUpdate)
          return bailoutHooks(current, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        isHydrating && key && pushMaterializedTreeId(workInProgress2);
        workInProgress2.flags |= 1;
        reconcileChildren(current, workInProgress2, nextProps, renderLanes2);
        return workInProgress2.child;
      }
      function updateMemoComponent(current, workInProgress2, Component, nextProps, renderLanes2) {
        if (null === current) {
          var type2 = Component.type;
          if ("function" === typeof type2 && !shouldConstruct(type2) && void 0 === type2.defaultProps && null === Component.compare)
            return workInProgress2.tag = 15, workInProgress2.type = type2, updateSimpleMemoComponent(
              current,
              workInProgress2,
              type2,
              nextProps,
              renderLanes2
            );
          current = createFiberFromTypeAndProps(
            Component.type,
            null,
            nextProps,
            workInProgress2,
            workInProgress2.mode,
            renderLanes2
          );
          current.ref = workInProgress2.ref;
          current.return = workInProgress2;
          return workInProgress2.child = current;
        }
        type2 = current.child;
        if (!checkScheduledUpdateOrContext(current, renderLanes2)) {
          var prevProps = type2.memoizedProps;
          Component = Component.compare;
          Component = null !== Component ? Component : shallowEqual;
          if (Component(prevProps, nextProps) && current.ref === workInProgress2.ref)
            return bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        }
        workInProgress2.flags |= 1;
        current = createWorkInProgress(type2, nextProps);
        current.ref = workInProgress2.ref;
        current.return = workInProgress2;
        return workInProgress2.child = current;
      }
      function updateSimpleMemoComponent(current, workInProgress2, Component, nextProps, renderLanes2) {
        if (null !== current) {
          var prevProps = current.memoizedProps;
          if (shallowEqual(prevProps, nextProps) && current.ref === workInProgress2.ref)
            if (didReceiveUpdate = false, workInProgress2.pendingProps = nextProps = prevProps, checkScheduledUpdateOrContext(current, renderLanes2))
              0 !== (current.flags & 131072) && (didReceiveUpdate = true);
            else
              return workInProgress2.lanes = current.lanes, bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        }
        return updateFunctionComponent(
          current,
          workInProgress2,
          Component,
          nextProps,
          renderLanes2
        );
      }
      function updateOffscreenComponent(current, workInProgress2, renderLanes2) {
        var nextProps = workInProgress2.pendingProps, nextChildren = nextProps.children, nextIsDetached = 0 !== (workInProgress2.stateNode._pendingVisibility & 2), prevState = null !== current ? current.memoizedState : null;
        markRef(current, workInProgress2);
        if ("hidden" === nextProps.mode || nextIsDetached) {
          if (0 !== (workInProgress2.flags & 128)) {
            nextProps = null !== prevState ? prevState.baseLanes | renderLanes2 : renderLanes2;
            if (null !== current) {
              nextChildren = workInProgress2.child = current.child;
              for (nextIsDetached = 0; null !== nextChildren; )
                nextIsDetached = nextIsDetached | nextChildren.lanes | nextChildren.childLanes, nextChildren = nextChildren.sibling;
              workInProgress2.childLanes = nextIsDetached & ~nextProps;
            } else workInProgress2.childLanes = 0, workInProgress2.child = null;
            return deferHiddenOffscreenComponent(
              current,
              workInProgress2,
              nextProps,
              renderLanes2
            );
          }
          if (0 !== (renderLanes2 & 536870912))
            workInProgress2.memoizedState = { baseLanes: 0, cachePool: null }, null !== current && pushTransition(
              workInProgress2,
              null !== prevState ? prevState.cachePool : null
            ), null !== prevState ? pushHiddenContext(workInProgress2, prevState) : reuseHiddenContextOnStack(), pushOffscreenSuspenseHandler(workInProgress2);
          else
            return workInProgress2.lanes = workInProgress2.childLanes = 536870912, deferHiddenOffscreenComponent(
              current,
              workInProgress2,
              null !== prevState ? prevState.baseLanes | renderLanes2 : renderLanes2,
              renderLanes2
            );
        } else
          null !== prevState ? (pushTransition(workInProgress2, prevState.cachePool), pushHiddenContext(workInProgress2, prevState), reuseSuspenseHandlerOnStack(workInProgress2), workInProgress2.memoizedState = null) : (null !== current && pushTransition(workInProgress2, null), reuseHiddenContextOnStack(), reuseSuspenseHandlerOnStack(workInProgress2));
        reconcileChildren(current, workInProgress2, nextChildren, renderLanes2);
        return workInProgress2.child;
      }
      function deferHiddenOffscreenComponent(current, workInProgress2, nextBaseLanes, renderLanes2) {
        var JSCompiler_inline_result = peekCacheFromPool();
        JSCompiler_inline_result = null === JSCompiler_inline_result ? null : { parent: CacheContext._currentValue, pool: JSCompiler_inline_result };
        workInProgress2.memoizedState = {
          baseLanes: nextBaseLanes,
          cachePool: JSCompiler_inline_result
        };
        null !== current && pushTransition(workInProgress2, null);
        reuseHiddenContextOnStack();
        pushOffscreenSuspenseHandler(workInProgress2);
        null !== current && propagateParentContextChanges(current, workInProgress2, renderLanes2, true);
        return null;
      }
      function markRef(current, workInProgress2) {
        var ref = workInProgress2.ref;
        if (null === ref)
          null !== current && null !== current.ref && (workInProgress2.flags |= 2097664);
        else {
          if ("function" !== typeof ref && "object" !== typeof ref)
            throw Error(formatProdErrorMessage(284));
          if (null === current || current.ref !== ref)
            workInProgress2.flags |= 2097664;
        }
      }
      function updateFunctionComponent(current, workInProgress2, Component, nextProps, renderLanes2) {
        prepareToReadContext(workInProgress2);
        Component = renderWithHooks(
          current,
          workInProgress2,
          Component,
          nextProps,
          void 0,
          renderLanes2
        );
        nextProps = checkDidRenderIdHook();
        if (null !== current && !didReceiveUpdate)
          return bailoutHooks(current, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        isHydrating && nextProps && pushMaterializedTreeId(workInProgress2);
        workInProgress2.flags |= 1;
        reconcileChildren(current, workInProgress2, Component, renderLanes2);
        return workInProgress2.child;
      }
      function replayFunctionComponent(current, workInProgress2, nextProps, Component, secondArg, renderLanes2) {
        prepareToReadContext(workInProgress2);
        workInProgress2.updateQueue = null;
        nextProps = renderWithHooksAgain(
          workInProgress2,
          Component,
          nextProps,
          secondArg
        );
        finishRenderingHooks(current);
        Component = checkDidRenderIdHook();
        if (null !== current && !didReceiveUpdate)
          return bailoutHooks(current, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        isHydrating && Component && pushMaterializedTreeId(workInProgress2);
        workInProgress2.flags |= 1;
        reconcileChildren(current, workInProgress2, nextProps, renderLanes2);
        return workInProgress2.child;
      }
      function updateClassComponent(current, workInProgress2, Component, nextProps, renderLanes2) {
        prepareToReadContext(workInProgress2);
        if (null === workInProgress2.stateNode) {
          var context = emptyContextObject, contextType = Component.contextType;
          "object" === typeof contextType && null !== contextType && (context = readContext(contextType));
          context = new Component(nextProps, context);
          workInProgress2.memoizedState = null !== context.state && void 0 !== context.state ? context.state : null;
          context.updater = classComponentUpdater;
          workInProgress2.stateNode = context;
          context._reactInternals = workInProgress2;
          context = workInProgress2.stateNode;
          context.props = nextProps;
          context.state = workInProgress2.memoizedState;
          context.refs = {};
          initializeUpdateQueue(workInProgress2);
          contextType = Component.contextType;
          context.context = "object" === typeof contextType && null !== contextType ? readContext(contextType) : emptyContextObject;
          context.state = workInProgress2.memoizedState;
          contextType = Component.getDerivedStateFromProps;
          "function" === typeof contextType && (applyDerivedStateFromProps(
            workInProgress2,
            Component,
            contextType,
            nextProps
          ), context.state = workInProgress2.memoizedState);
          "function" === typeof Component.getDerivedStateFromProps || "function" === typeof context.getSnapshotBeforeUpdate || "function" !== typeof context.UNSAFE_componentWillMount && "function" !== typeof context.componentWillMount || (contextType = context.state, "function" === typeof context.componentWillMount && context.componentWillMount(), "function" === typeof context.UNSAFE_componentWillMount && context.UNSAFE_componentWillMount(), contextType !== context.state && classComponentUpdater.enqueueReplaceState(context, context.state, null), processUpdateQueue(workInProgress2, nextProps, context, renderLanes2), suspendIfUpdateReadFromEntangledAsyncAction(), context.state = workInProgress2.memoizedState);
          "function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308);
          nextProps = true;
        } else if (null === current) {
          context = workInProgress2.stateNode;
          var unresolvedOldProps = workInProgress2.memoizedProps, oldProps = resolveClassComponentProps(Component, unresolvedOldProps);
          context.props = oldProps;
          var oldContext = context.context, contextType$jscomp$0 = Component.contextType;
          contextType = emptyContextObject;
          "object" === typeof contextType$jscomp$0 && null !== contextType$jscomp$0 && (contextType = readContext(contextType$jscomp$0));
          var getDerivedStateFromProps = Component.getDerivedStateFromProps;
          contextType$jscomp$0 = "function" === typeof getDerivedStateFromProps || "function" === typeof context.getSnapshotBeforeUpdate;
          unresolvedOldProps = workInProgress2.pendingProps !== unresolvedOldProps;
          contextType$jscomp$0 || "function" !== typeof context.UNSAFE_componentWillReceiveProps && "function" !== typeof context.componentWillReceiveProps || (unresolvedOldProps || oldContext !== contextType) && callComponentWillReceiveProps(
            workInProgress2,
            context,
            nextProps,
            contextType
          );
          hasForceUpdate = false;
          var oldState = workInProgress2.memoizedState;
          context.state = oldState;
          processUpdateQueue(workInProgress2, nextProps, context, renderLanes2);
          suspendIfUpdateReadFromEntangledAsyncAction();
          oldContext = workInProgress2.memoizedState;
          unresolvedOldProps || oldState !== oldContext || hasForceUpdate ? ("function" === typeof getDerivedStateFromProps && (applyDerivedStateFromProps(
            workInProgress2,
            Component,
            getDerivedStateFromProps,
            nextProps
          ), oldContext = workInProgress2.memoizedState), (oldProps = hasForceUpdate || checkShouldComponentUpdate(
            workInProgress2,
            Component,
            oldProps,
            nextProps,
            oldState,
            oldContext,
            contextType
          )) ? (contextType$jscomp$0 || "function" !== typeof context.UNSAFE_componentWillMount && "function" !== typeof context.componentWillMount || ("function" === typeof context.componentWillMount && context.componentWillMount(), "function" === typeof context.UNSAFE_componentWillMount && context.UNSAFE_componentWillMount()), "function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308)) : ("function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308), workInProgress2.memoizedProps = nextProps, workInProgress2.memoizedState = oldContext), context.props = nextProps, context.state = oldContext, context.context = contextType, nextProps = oldProps) : ("function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308), nextProps = false);
        } else {
          context = workInProgress2.stateNode;
          cloneUpdateQueue(current, workInProgress2);
          contextType = workInProgress2.memoizedProps;
          contextType$jscomp$0 = resolveClassComponentProps(Component, contextType);
          context.props = contextType$jscomp$0;
          getDerivedStateFromProps = workInProgress2.pendingProps;
          oldState = context.context;
          oldContext = Component.contextType;
          oldProps = emptyContextObject;
          "object" === typeof oldContext && null !== oldContext && (oldProps = readContext(oldContext));
          unresolvedOldProps = Component.getDerivedStateFromProps;
          (oldContext = "function" === typeof unresolvedOldProps || "function" === typeof context.getSnapshotBeforeUpdate) || "function" !== typeof context.UNSAFE_componentWillReceiveProps && "function" !== typeof context.componentWillReceiveProps || (contextType !== getDerivedStateFromProps || oldState !== oldProps) && callComponentWillReceiveProps(
            workInProgress2,
            context,
            nextProps,
            oldProps
          );
          hasForceUpdate = false;
          oldState = workInProgress2.memoizedState;
          context.state = oldState;
          processUpdateQueue(workInProgress2, nextProps, context, renderLanes2);
          suspendIfUpdateReadFromEntangledAsyncAction();
          var newState = workInProgress2.memoizedState;
          contextType !== getDerivedStateFromProps || oldState !== newState || hasForceUpdate || null !== current && null !== current.dependencies && checkIfContextChanged(current.dependencies) ? ("function" === typeof unresolvedOldProps && (applyDerivedStateFromProps(
            workInProgress2,
            Component,
            unresolvedOldProps,
            nextProps
          ), newState = workInProgress2.memoizedState), (contextType$jscomp$0 = hasForceUpdate || checkShouldComponentUpdate(
            workInProgress2,
            Component,
            contextType$jscomp$0,
            nextProps,
            oldState,
            newState,
            oldProps
          ) || null !== current && null !== current.dependencies && checkIfContextChanged(current.dependencies)) ? (oldContext || "function" !== typeof context.UNSAFE_componentWillUpdate && "function" !== typeof context.componentWillUpdate || ("function" === typeof context.componentWillUpdate && context.componentWillUpdate(nextProps, newState, oldProps), "function" === typeof context.UNSAFE_componentWillUpdate && context.UNSAFE_componentWillUpdate(
            nextProps,
            newState,
            oldProps
          )), "function" === typeof context.componentDidUpdate && (workInProgress2.flags |= 4), "function" === typeof context.getSnapshotBeforeUpdate && (workInProgress2.flags |= 1024)) : ("function" !== typeof context.componentDidUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 4), "function" !== typeof context.getSnapshotBeforeUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 1024), workInProgress2.memoizedProps = nextProps, workInProgress2.memoizedState = newState), context.props = nextProps, context.state = newState, context.context = oldProps, nextProps = contextType$jscomp$0) : ("function" !== typeof context.componentDidUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 4), "function" !== typeof context.getSnapshotBeforeUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 1024), nextProps = false);
        }
        context = nextProps;
        markRef(current, workInProgress2);
        nextProps = 0 !== (workInProgress2.flags & 128);
        context || nextProps ? (context = workInProgress2.stateNode, Component = nextProps && "function" !== typeof Component.getDerivedStateFromError ? null : context.render(), workInProgress2.flags |= 1, null !== current && nextProps ? (workInProgress2.child = reconcileChildFibers(
          workInProgress2,
          current.child,
          null,
          renderLanes2
        ), workInProgress2.child = reconcileChildFibers(
          workInProgress2,
          null,
          Component,
          renderLanes2
        )) : reconcileChildren(current, workInProgress2, Component, renderLanes2), workInProgress2.memoizedState = context.state, current = workInProgress2.child) : current = bailoutOnAlreadyFinishedWork(
          current,
          workInProgress2,
          renderLanes2
        );
        return current;
      }
      function mountHostRootWithoutHydrating(current, workInProgress2, nextChildren, renderLanes2) {
        resetHydrationState();
        workInProgress2.flags |= 256;
        reconcileChildren(current, workInProgress2, nextChildren, renderLanes2);
        return workInProgress2.child;
      }
      var SUSPENDED_MARKER = { dehydrated: null, treeContext: null, retryLane: 0 };
      function mountSuspenseOffscreenState(renderLanes2) {
        return { baseLanes: renderLanes2, cachePool: getSuspendedCache() };
      }
      function getRemainingWorkInPrimaryTree(current, primaryTreeDidDefer, renderLanes2) {
        current = null !== current ? current.childLanes & ~renderLanes2 : 0;
        primaryTreeDidDefer && (current |= workInProgressDeferredLane);
        return current;
      }
      function updateSuspenseComponent(current, workInProgress2, renderLanes2) {
        var nextProps = workInProgress2.pendingProps, showFallback = false, didSuspend = 0 !== (workInProgress2.flags & 128), JSCompiler_temp;
        (JSCompiler_temp = didSuspend) || (JSCompiler_temp = null !== current && null === current.memoizedState ? false : 0 !== (suspenseStackCursor.current & 2));
        JSCompiler_temp && (showFallback = true, workInProgress2.flags &= -129);
        JSCompiler_temp = 0 !== (workInProgress2.flags & 32);
        workInProgress2.flags &= -33;
        if (null === current) {
          if (isHydrating) {
            showFallback ? pushPrimaryTreeSuspenseHandler(workInProgress2) : reuseSuspenseHandlerOnStack(workInProgress2);
            if (isHydrating) {
              var nextInstance = nextHydratableInstance, JSCompiler_temp$jscomp$0;
              if (JSCompiler_temp$jscomp$0 = nextInstance) {
                c: {
                  JSCompiler_temp$jscomp$0 = nextInstance;
                  for (nextInstance = rootOrSingletonContext; 8 !== JSCompiler_temp$jscomp$0.nodeType; ) {
                    if (!nextInstance) {
                      nextInstance = null;
                      break c;
                    }
                    JSCompiler_temp$jscomp$0 = getNextHydratable(
                      JSCompiler_temp$jscomp$0.nextSibling
                    );
                    if (null === JSCompiler_temp$jscomp$0) {
                      nextInstance = null;
                      break c;
                    }
                  }
                  nextInstance = JSCompiler_temp$jscomp$0;
                }
                null !== nextInstance ? (workInProgress2.memoizedState = {
                  dehydrated: nextInstance,
                  treeContext: null !== treeContextProvider ? { id: treeContextId, overflow: treeContextOverflow } : null,
                  retryLane: 536870912
                }, JSCompiler_temp$jscomp$0 = createFiberImplClass(
                  18,
                  null,
                  null,
                  0
                ), JSCompiler_temp$jscomp$0.stateNode = nextInstance, JSCompiler_temp$jscomp$0.return = workInProgress2, workInProgress2.child = JSCompiler_temp$jscomp$0, hydrationParentFiber = workInProgress2, nextHydratableInstance = null, JSCompiler_temp$jscomp$0 = true) : JSCompiler_temp$jscomp$0 = false;
              }
              JSCompiler_temp$jscomp$0 || throwOnHydrationMismatch(workInProgress2);
            }
            nextInstance = workInProgress2.memoizedState;
            if (null !== nextInstance && (nextInstance = nextInstance.dehydrated, null !== nextInstance))
              return "$!" === nextInstance.data ? workInProgress2.lanes = 16 : workInProgress2.lanes = 536870912, null;
            popSuspenseHandler(workInProgress2);
          }
          nextInstance = nextProps.children;
          nextProps = nextProps.fallback;
          if (showFallback)
            return reuseSuspenseHandlerOnStack(workInProgress2), showFallback = workInProgress2.mode, nextInstance = mountWorkInProgressOffscreenFiber(
              { mode: "hidden", children: nextInstance },
              showFallback
            ), nextProps = createFiberFromFragment(
              nextProps,
              showFallback,
              renderLanes2,
              null
            ), nextInstance.return = workInProgress2, nextProps.return = workInProgress2, nextInstance.sibling = nextProps, workInProgress2.child = nextInstance, showFallback = workInProgress2.child, showFallback.memoizedState = mountSuspenseOffscreenState(renderLanes2), showFallback.childLanes = getRemainingWorkInPrimaryTree(
              current,
              JSCompiler_temp,
              renderLanes2
            ), workInProgress2.memoizedState = SUSPENDED_MARKER, nextProps;
          pushPrimaryTreeSuspenseHandler(workInProgress2);
          return mountSuspensePrimaryChildren(workInProgress2, nextInstance);
        }
        JSCompiler_temp$jscomp$0 = current.memoizedState;
        if (null !== JSCompiler_temp$jscomp$0 && (nextInstance = JSCompiler_temp$jscomp$0.dehydrated, null !== nextInstance)) {
          if (didSuspend)
            workInProgress2.flags & 256 ? (pushPrimaryTreeSuspenseHandler(workInProgress2), workInProgress2.flags &= -257, workInProgress2 = retrySuspenseComponentWithoutHydrating(
              current,
              workInProgress2,
              renderLanes2
            )) : null !== workInProgress2.memoizedState ? (reuseSuspenseHandlerOnStack(workInProgress2), workInProgress2.child = current.child, workInProgress2.flags |= 128, workInProgress2 = null) : (reuseSuspenseHandlerOnStack(workInProgress2), showFallback = nextProps.fallback, nextInstance = workInProgress2.mode, nextProps = mountWorkInProgressOffscreenFiber(
              { mode: "visible", children: nextProps.children },
              nextInstance
            ), showFallback = createFiberFromFragment(
              showFallback,
              nextInstance,
              renderLanes2,
              null
            ), showFallback.flags |= 2, nextProps.return = workInProgress2, showFallback.return = workInProgress2, nextProps.sibling = showFallback, workInProgress2.child = nextProps, reconcileChildFibers(
              workInProgress2,
              current.child,
              null,
              renderLanes2
            ), nextProps = workInProgress2.child, nextProps.memoizedState = mountSuspenseOffscreenState(renderLanes2), nextProps.childLanes = getRemainingWorkInPrimaryTree(
              current,
              JSCompiler_temp,
              renderLanes2
            ), workInProgress2.memoizedState = SUSPENDED_MARKER, workInProgress2 = showFallback);
          else if (pushPrimaryTreeSuspenseHandler(workInProgress2), "$!" === nextInstance.data) {
            JSCompiler_temp = nextInstance.nextSibling && nextInstance.nextSibling.dataset;
            if (JSCompiler_temp) var digest = JSCompiler_temp.dgst;
            JSCompiler_temp = digest;
            nextProps = Error(formatProdErrorMessage(419));
            nextProps.stack = "";
            nextProps.digest = JSCompiler_temp;
            queueHydrationError({ value: nextProps, source: null, stack: null });
            workInProgress2 = retrySuspenseComponentWithoutHydrating(
              current,
              workInProgress2,
              renderLanes2
            );
          } else if (didReceiveUpdate || propagateParentContextChanges(current, workInProgress2, renderLanes2, false), JSCompiler_temp = 0 !== (renderLanes2 & current.childLanes), didReceiveUpdate || JSCompiler_temp) {
            JSCompiler_temp = workInProgressRoot;
            if (null !== JSCompiler_temp) {
              nextProps = renderLanes2 & -renderLanes2;
              if (0 !== (nextProps & 42)) nextProps = 1;
              else
                switch (nextProps) {
                  case 2:
                    nextProps = 1;
                    break;
                  case 8:
                    nextProps = 4;
                    break;
                  case 32:
                    nextProps = 16;
                    break;
                  case 128:
                  case 256:
                  case 512:
                  case 1024:
                  case 2048:
                  case 4096:
                  case 8192:
                  case 16384:
                  case 32768:
                  case 65536:
                  case 131072:
                  case 262144:
                  case 524288:
                  case 1048576:
                  case 2097152:
                  case 4194304:
                  case 8388608:
                  case 16777216:
                  case 33554432:
                    nextProps = 64;
                    break;
                  case 268435456:
                    nextProps = 134217728;
                    break;
                  default:
                    nextProps = 0;
                }
              nextProps = 0 !== (nextProps & (JSCompiler_temp.suspendedLanes | renderLanes2)) ? 0 : nextProps;
              if (0 !== nextProps && nextProps !== JSCompiler_temp$jscomp$0.retryLane)
                throw JSCompiler_temp$jscomp$0.retryLane = nextProps, enqueueConcurrentRenderForLane(current, nextProps), scheduleUpdateOnFiber(JSCompiler_temp, current, nextProps), SelectiveHydrationException;
            }
            "$?" === nextInstance.data || renderDidSuspendDelayIfPossible();
            workInProgress2 = retrySuspenseComponentWithoutHydrating(
              current,
              workInProgress2,
              renderLanes2
            );
          } else
            "$?" === nextInstance.data ? (workInProgress2.flags |= 128, workInProgress2.child = current.child, workInProgress2 = retryDehydratedSuspenseBoundary.bind(
              null,
              current
            ), nextInstance._reactRetry = workInProgress2, workInProgress2 = null) : (current = JSCompiler_temp$jscomp$0.treeContext, nextHydratableInstance = getNextHydratable(
              nextInstance.nextSibling
            ), hydrationParentFiber = workInProgress2, isHydrating = true, hydrationErrors = null, rootOrSingletonContext = false, null !== current && (idStack[idStackIndex++] = treeContextId, idStack[idStackIndex++] = treeContextOverflow, idStack[idStackIndex++] = treeContextProvider, treeContextId = current.id, treeContextOverflow = current.overflow, treeContextProvider = workInProgress2), workInProgress2 = mountSuspensePrimaryChildren(
              workInProgress2,
              nextProps.children
            ), workInProgress2.flags |= 4096);
          return workInProgress2;
        }
        if (showFallback)
          return reuseSuspenseHandlerOnStack(workInProgress2), showFallback = nextProps.fallback, nextInstance = workInProgress2.mode, JSCompiler_temp$jscomp$0 = current.child, digest = JSCompiler_temp$jscomp$0.sibling, nextProps = createWorkInProgress(JSCompiler_temp$jscomp$0, {
            mode: "hidden",
            children: nextProps.children
          }), nextProps.subtreeFlags = JSCompiler_temp$jscomp$0.subtreeFlags & 31457280, null !== digest ? showFallback = createWorkInProgress(digest, showFallback) : (showFallback = createFiberFromFragment(
            showFallback,
            nextInstance,
            renderLanes2,
            null
          ), showFallback.flags |= 2), showFallback.return = workInProgress2, nextProps.return = workInProgress2, nextProps.sibling = showFallback, workInProgress2.child = nextProps, nextProps = showFallback, showFallback = workInProgress2.child, nextInstance = current.child.memoizedState, null === nextInstance ? nextInstance = mountSuspenseOffscreenState(renderLanes2) : (JSCompiler_temp$jscomp$0 = nextInstance.cachePool, null !== JSCompiler_temp$jscomp$0 ? (digest = CacheContext._currentValue, JSCompiler_temp$jscomp$0 = JSCompiler_temp$jscomp$0.parent !== digest ? { parent: digest, pool: digest } : JSCompiler_temp$jscomp$0) : JSCompiler_temp$jscomp$0 = getSuspendedCache(), nextInstance = {
            baseLanes: nextInstance.baseLanes | renderLanes2,
            cachePool: JSCompiler_temp$jscomp$0
          }), showFallback.memoizedState = nextInstance, showFallback.childLanes = getRemainingWorkInPrimaryTree(
            current,
            JSCompiler_temp,
            renderLanes2
          ), workInProgress2.memoizedState = SUSPENDED_MARKER, nextProps;
        pushPrimaryTreeSuspenseHandler(workInProgress2);
        renderLanes2 = current.child;
        current = renderLanes2.sibling;
        renderLanes2 = createWorkInProgress(renderLanes2, {
          mode: "visible",
          children: nextProps.children
        });
        renderLanes2.return = workInProgress2;
        renderLanes2.sibling = null;
        null !== current && (JSCompiler_temp = workInProgress2.deletions, null === JSCompiler_temp ? (workInProgress2.deletions = [current], workInProgress2.flags |= 16) : JSCompiler_temp.push(current));
        workInProgress2.child = renderLanes2;
        workInProgress2.memoizedState = null;
        return renderLanes2;
      }
      function mountSuspensePrimaryChildren(workInProgress2, primaryChildren) {
        primaryChildren = mountWorkInProgressOffscreenFiber(
          { mode: "visible", children: primaryChildren },
          workInProgress2.mode
        );
        primaryChildren.return = workInProgress2;
        return workInProgress2.child = primaryChildren;
      }
      function mountWorkInProgressOffscreenFiber(offscreenProps, mode2) {
        return createFiberFromOffscreen(offscreenProps, mode2, 0, null);
      }
      function retrySuspenseComponentWithoutHydrating(current, workInProgress2, renderLanes2) {
        reconcileChildFibers(workInProgress2, current.child, null, renderLanes2);
        current = mountSuspensePrimaryChildren(
          workInProgress2,
          workInProgress2.pendingProps.children
        );
        current.flags |= 2;
        workInProgress2.memoizedState = null;
        return current;
      }
      function scheduleSuspenseWorkOnFiber(fiber, renderLanes2, propagationRoot) {
        fiber.lanes |= renderLanes2;
        var alternate = fiber.alternate;
        null !== alternate && (alternate.lanes |= renderLanes2);
        scheduleContextWorkOnParentPath(fiber.return, renderLanes2, propagationRoot);
      }
      function initSuspenseListRenderState(workInProgress2, isBackwards, tail, lastContentRow, tailMode) {
        var renderState = workInProgress2.memoizedState;
        null === renderState ? workInProgress2.memoizedState = {
          isBackwards,
          rendering: null,
          renderingStartTime: 0,
          last: lastContentRow,
          tail,
          tailMode
        } : (renderState.isBackwards = isBackwards, renderState.rendering = null, renderState.renderingStartTime = 0, renderState.last = lastContentRow, renderState.tail = tail, renderState.tailMode = tailMode);
      }
      function updateSuspenseListComponent(current, workInProgress2, renderLanes2) {
        var nextProps = workInProgress2.pendingProps, revealOrder = nextProps.revealOrder, tailMode = nextProps.tail;
        reconcileChildren(current, workInProgress2, nextProps.children, renderLanes2);
        nextProps = suspenseStackCursor.current;
        if (0 !== (nextProps & 2))
          nextProps = nextProps & 1 | 2, workInProgress2.flags |= 128;
        else {
          if (null !== current && 0 !== (current.flags & 128))
            a: for (current = workInProgress2.child; null !== current; ) {
              if (13 === current.tag)
                null !== current.memoizedState && scheduleSuspenseWorkOnFiber(current, renderLanes2, workInProgress2);
              else if (19 === current.tag)
                scheduleSuspenseWorkOnFiber(current, renderLanes2, workInProgress2);
              else if (null !== current.child) {
                current.child.return = current;
                current = current.child;
                continue;
              }
              if (current === workInProgress2) break a;
              for (; null === current.sibling; ) {
                if (null === current.return || current.return === workInProgress2)
                  break a;
                current = current.return;
              }
              current.sibling.return = current.return;
              current = current.sibling;
            }
          nextProps &= 1;
        }
        push(suspenseStackCursor, nextProps);
        switch (revealOrder) {
          case "forwards":
            renderLanes2 = workInProgress2.child;
            for (revealOrder = null; null !== renderLanes2; )
              current = renderLanes2.alternate, null !== current && null === findFirstSuspended(current) && (revealOrder = renderLanes2), renderLanes2 = renderLanes2.sibling;
            renderLanes2 = revealOrder;
            null === renderLanes2 ? (revealOrder = workInProgress2.child, workInProgress2.child = null) : (revealOrder = renderLanes2.sibling, renderLanes2.sibling = null);
            initSuspenseListRenderState(
              workInProgress2,
              false,
              revealOrder,
              renderLanes2,
              tailMode
            );
            break;
          case "backwards":
            renderLanes2 = null;
            revealOrder = workInProgress2.child;
            for (workInProgress2.child = null; null !== revealOrder; ) {
              current = revealOrder.alternate;
              if (null !== current && null === findFirstSuspended(current)) {
                workInProgress2.child = revealOrder;
                break;
              }
              current = revealOrder.sibling;
              revealOrder.sibling = renderLanes2;
              renderLanes2 = revealOrder;
              revealOrder = current;
            }
            initSuspenseListRenderState(
              workInProgress2,
              true,
              renderLanes2,
              null,
              tailMode
            );
            break;
          case "together":
            initSuspenseListRenderState(workInProgress2, false, null, null, void 0);
            break;
          default:
            workInProgress2.memoizedState = null;
        }
        return workInProgress2.child;
      }
      function bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2) {
        null !== current && (workInProgress2.dependencies = current.dependencies);
        workInProgressRootSkippedLanes |= workInProgress2.lanes;
        if (0 === (renderLanes2 & workInProgress2.childLanes))
          if (null !== current) {
            if (propagateParentContextChanges(
              current,
              workInProgress2,
              renderLanes2,
              false
            ), 0 === (renderLanes2 & workInProgress2.childLanes))
              return null;
          } else return null;
        if (null !== current && workInProgress2.child !== current.child)
          throw Error(formatProdErrorMessage(153));
        if (null !== workInProgress2.child) {
          current = workInProgress2.child;
          renderLanes2 = createWorkInProgress(current, current.pendingProps);
          workInProgress2.child = renderLanes2;
          for (renderLanes2.return = workInProgress2; null !== current.sibling; )
            current = current.sibling, renderLanes2 = renderLanes2.sibling = createWorkInProgress(current, current.pendingProps), renderLanes2.return = workInProgress2;
          renderLanes2.sibling = null;
        }
        return workInProgress2.child;
      }
      function checkScheduledUpdateOrContext(current, renderLanes2) {
        if (0 !== (current.lanes & renderLanes2)) return true;
        current = current.dependencies;
        return null !== current && checkIfContextChanged(current) ? true : false;
      }
      function attemptEarlyBailoutIfNoScheduledUpdate(current, workInProgress2, renderLanes2) {
        switch (workInProgress2.tag) {
          case 3:
            pushHostContainer(workInProgress2, workInProgress2.stateNode.containerInfo);
            pushProvider(workInProgress2, CacheContext, current.memoizedState.cache);
            resetHydrationState();
            break;
          case 27:
          case 5:
            pushHostContext(workInProgress2);
            break;
          case 4:
            pushHostContainer(workInProgress2, workInProgress2.stateNode.containerInfo);
            break;
          case 10:
            pushProvider(
              workInProgress2,
              workInProgress2.type,
              workInProgress2.memoizedProps.value
            );
            break;
          case 13:
            var state = workInProgress2.memoizedState;
            if (null !== state) {
              if (null !== state.dehydrated)
                return pushPrimaryTreeSuspenseHandler(workInProgress2), workInProgress2.flags |= 128, null;
              if (0 !== (renderLanes2 & workInProgress2.child.childLanes))
                return updateSuspenseComponent(current, workInProgress2, renderLanes2);
              pushPrimaryTreeSuspenseHandler(workInProgress2);
              current = bailoutOnAlreadyFinishedWork(
                current,
                workInProgress2,
                renderLanes2
              );
              return null !== current ? current.sibling : null;
            }
            pushPrimaryTreeSuspenseHandler(workInProgress2);
            break;
          case 19:
            var didSuspendBefore = 0 !== (current.flags & 128);
            state = 0 !== (renderLanes2 & workInProgress2.childLanes);
            state || (propagateParentContextChanges(
              current,
              workInProgress2,
              renderLanes2,
              false
            ), state = 0 !== (renderLanes2 & workInProgress2.childLanes));
            if (didSuspendBefore) {
              if (state)
                return updateSuspenseListComponent(
                  current,
                  workInProgress2,
                  renderLanes2
                );
              workInProgress2.flags |= 128;
            }
            didSuspendBefore = workInProgress2.memoizedState;
            null !== didSuspendBefore && (didSuspendBefore.rendering = null, didSuspendBefore.tail = null, didSuspendBefore.lastEffect = null);
            push(suspenseStackCursor, suspenseStackCursor.current);
            if (state) break;
            else return null;
          case 22:
          case 23:
            return workInProgress2.lanes = 0, updateOffscreenComponent(current, workInProgress2, renderLanes2);
          case 24:
            pushProvider(workInProgress2, CacheContext, current.memoizedState.cache);
        }
        return bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
      }
      function beginWork(current, workInProgress2, renderLanes2) {
        if (null !== current)
          if (current.memoizedProps !== workInProgress2.pendingProps)
            didReceiveUpdate = true;
          else {
            if (!checkScheduledUpdateOrContext(current, renderLanes2) && 0 === (workInProgress2.flags & 128))
              return didReceiveUpdate = false, attemptEarlyBailoutIfNoScheduledUpdate(
                current,
                workInProgress2,
                renderLanes2
              );
            didReceiveUpdate = 0 !== (current.flags & 131072) ? true : false;
          }
        else
          didReceiveUpdate = false, isHydrating && 0 !== (workInProgress2.flags & 1048576) && pushTreeId(workInProgress2, treeForkCount, workInProgress2.index);
        workInProgress2.lanes = 0;
        switch (workInProgress2.tag) {
          case 16:
            a: {
              current = workInProgress2.pendingProps;
              var lazyComponent = workInProgress2.elementType, init = lazyComponent._init;
              lazyComponent = init(lazyComponent._payload);
              workInProgress2.type = lazyComponent;
              if ("function" === typeof lazyComponent)
                shouldConstruct(lazyComponent) ? (current = resolveClassComponentProps(lazyComponent, current), workInProgress2.tag = 1, workInProgress2 = updateClassComponent(
                  null,
                  workInProgress2,
                  lazyComponent,
                  current,
                  renderLanes2
                )) : (workInProgress2.tag = 0, workInProgress2 = updateFunctionComponent(
                  null,
                  workInProgress2,
                  lazyComponent,
                  current,
                  renderLanes2
                ));
              else {
                if (void 0 !== lazyComponent && null !== lazyComponent) {
                  if (init = lazyComponent.$$typeof, init === REACT_FORWARD_REF_TYPE) {
                    workInProgress2.tag = 11;
                    workInProgress2 = updateForwardRef(
                      null,
                      workInProgress2,
                      lazyComponent,
                      current,
                      renderLanes2
                    );
                    break a;
                  } else if (init === REACT_MEMO_TYPE) {
                    workInProgress2.tag = 14;
                    workInProgress2 = updateMemoComponent(
                      null,
                      workInProgress2,
                      lazyComponent,
                      current,
                      renderLanes2
                    );
                    break a;
                  }
                }
                workInProgress2 = getComponentNameFromType(lazyComponent) || lazyComponent;
                throw Error(formatProdErrorMessage(306, workInProgress2, ""));
              }
            }
            return workInProgress2;
          case 0:
            return updateFunctionComponent(
              current,
              workInProgress2,
              workInProgress2.type,
              workInProgress2.pendingProps,
              renderLanes2
            );
          case 1:
            return lazyComponent = workInProgress2.type, init = resolveClassComponentProps(
              lazyComponent,
              workInProgress2.pendingProps
            ), updateClassComponent(
              current,
              workInProgress2,
              lazyComponent,
              init,
              renderLanes2
            );
          case 3:
            a: {
              pushHostContainer(
                workInProgress2,
                workInProgress2.stateNode.containerInfo
              );
              if (null === current) throw Error(formatProdErrorMessage(387));
              var nextProps = workInProgress2.pendingProps;
              init = workInProgress2.memoizedState;
              lazyComponent = init.element;
              cloneUpdateQueue(current, workInProgress2);
              processUpdateQueue(workInProgress2, nextProps, null, renderLanes2);
              var nextState = workInProgress2.memoizedState;
              nextProps = nextState.cache;
              pushProvider(workInProgress2, CacheContext, nextProps);
              nextProps !== init.cache && propagateContextChanges(
                workInProgress2,
                [CacheContext],
                renderLanes2,
                true
              );
              suspendIfUpdateReadFromEntangledAsyncAction();
              nextProps = nextState.element;
              if (init.isDehydrated)
                if (init = {
                  element: nextProps,
                  isDehydrated: false,
                  cache: nextState.cache
                }, workInProgress2.updateQueue.baseState = init, workInProgress2.memoizedState = init, workInProgress2.flags & 256) {
                  workInProgress2 = mountHostRootWithoutHydrating(
                    current,
                    workInProgress2,
                    nextProps,
                    renderLanes2
                  );
                  break a;
                } else if (nextProps !== lazyComponent) {
                  lazyComponent = createCapturedValueAtFiber(
                    Error(formatProdErrorMessage(424)),
                    workInProgress2
                  );
                  queueHydrationError(lazyComponent);
                  workInProgress2 = mountHostRootWithoutHydrating(
                    current,
                    workInProgress2,
                    nextProps,
                    renderLanes2
                  );
                  break a;
                } else
                  for (nextHydratableInstance = getNextHydratable(
                    workInProgress2.stateNode.containerInfo.firstChild
                  ), hydrationParentFiber = workInProgress2, isHydrating = true, hydrationErrors = null, rootOrSingletonContext = true, renderLanes2 = mountChildFibers(
                    workInProgress2,
                    null,
                    nextProps,
                    renderLanes2
                  ), workInProgress2.child = renderLanes2; renderLanes2; )
                    renderLanes2.flags = renderLanes2.flags & -3 | 4096, renderLanes2 = renderLanes2.sibling;
              else {
                resetHydrationState();
                if (nextProps === lazyComponent) {
                  workInProgress2 = bailoutOnAlreadyFinishedWork(
                    current,
                    workInProgress2,
                    renderLanes2
                  );
                  break a;
                }
                reconcileChildren(current, workInProgress2, nextProps, renderLanes2);
              }
              workInProgress2 = workInProgress2.child;
            }
            return workInProgress2;
          case 26:
            return markRef(current, workInProgress2), null === current ? (renderLanes2 = getResource(
              workInProgress2.type,
              null,
              workInProgress2.pendingProps,
              null
            )) ? workInProgress2.memoizedState = renderLanes2 : isHydrating || (renderLanes2 = workInProgress2.type, current = workInProgress2.pendingProps, lazyComponent = getOwnerDocumentFromRootContainer(
              rootInstanceStackCursor.current
            ).createElement(renderLanes2), lazyComponent[internalInstanceKey] = workInProgress2, lazyComponent[internalPropsKey] = current, setInitialProperties(lazyComponent, renderLanes2, current), markNodeAsHoistable(lazyComponent), workInProgress2.stateNode = lazyComponent) : workInProgress2.memoizedState = getResource(
              workInProgress2.type,
              current.memoizedProps,
              workInProgress2.pendingProps,
              current.memoizedState
            ), null;
          case 27:
            return pushHostContext(workInProgress2), null === current && isHydrating && (lazyComponent = workInProgress2.stateNode = resolveSingletonInstance(
              workInProgress2.type,
              workInProgress2.pendingProps,
              rootInstanceStackCursor.current
            ), hydrationParentFiber = workInProgress2, rootOrSingletonContext = true, nextHydratableInstance = getNextHydratable(
              lazyComponent.firstChild
            )), lazyComponent = workInProgress2.pendingProps.children, null !== current || isHydrating ? reconcileChildren(
              current,
              workInProgress2,
              lazyComponent,
              renderLanes2
            ) : workInProgress2.child = reconcileChildFibers(
              workInProgress2,
              null,
              lazyComponent,
              renderLanes2
            ), markRef(current, workInProgress2), workInProgress2.child;
          case 5:
            if (null === current && isHydrating) {
              if (init = lazyComponent = nextHydratableInstance)
                lazyComponent = canHydrateInstance(
                  lazyComponent,
                  workInProgress2.type,
                  workInProgress2.pendingProps,
                  rootOrSingletonContext
                ), null !== lazyComponent ? (workInProgress2.stateNode = lazyComponent, hydrationParentFiber = workInProgress2, nextHydratableInstance = getNextHydratable(
                  lazyComponent.firstChild
                ), rootOrSingletonContext = false, init = true) : init = false;
              init || throwOnHydrationMismatch(workInProgress2);
            }
            pushHostContext(workInProgress2);
            init = workInProgress2.type;
            nextProps = workInProgress2.pendingProps;
            nextState = null !== current ? current.memoizedProps : null;
            lazyComponent = nextProps.children;
            shouldSetTextContent(init, nextProps) ? lazyComponent = null : null !== nextState && shouldSetTextContent(init, nextState) && (workInProgress2.flags |= 32);
            null !== workInProgress2.memoizedState && (init = renderWithHooks(
              current,
              workInProgress2,
              TransitionAwareHostComponent,
              null,
              null,
              renderLanes2
            ), HostTransitionContext._currentValue = init);
            markRef(current, workInProgress2);
            reconcileChildren(current, workInProgress2, lazyComponent, renderLanes2);
            return workInProgress2.child;
          case 6:
            if (null === current && isHydrating) {
              if (current = renderLanes2 = nextHydratableInstance)
                renderLanes2 = canHydrateTextInstance(
                  renderLanes2,
                  workInProgress2.pendingProps,
                  rootOrSingletonContext
                ), null !== renderLanes2 ? (workInProgress2.stateNode = renderLanes2, hydrationParentFiber = workInProgress2, nextHydratableInstance = null, current = true) : current = false;
              current || throwOnHydrationMismatch(workInProgress2);
            }
            return null;
          case 13:
            return updateSuspenseComponent(current, workInProgress2, renderLanes2);
          case 4:
            return pushHostContainer(
              workInProgress2,
              workInProgress2.stateNode.containerInfo
            ), lazyComponent = workInProgress2.pendingProps, null === current ? workInProgress2.child = reconcileChildFibers(
              workInProgress2,
              null,
              lazyComponent,
              renderLanes2
            ) : reconcileChildren(
              current,
              workInProgress2,
              lazyComponent,
              renderLanes2
            ), workInProgress2.child;
          case 11:
            return updateForwardRef(
              current,
              workInProgress2,
              workInProgress2.type,
              workInProgress2.pendingProps,
              renderLanes2
            );
          case 7:
            return reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps,
              renderLanes2
            ), workInProgress2.child;
          case 8:
            return reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps.children,
              renderLanes2
            ), workInProgress2.child;
          case 12:
            return reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps.children,
              renderLanes2
            ), workInProgress2.child;
          case 10:
            return lazyComponent = workInProgress2.pendingProps, pushProvider(workInProgress2, workInProgress2.type, lazyComponent.value), reconcileChildren(
              current,
              workInProgress2,
              lazyComponent.children,
              renderLanes2
            ), workInProgress2.child;
          case 9:
            return init = workInProgress2.type._context, lazyComponent = workInProgress2.pendingProps.children, prepareToReadContext(workInProgress2), init = readContext(init), lazyComponent = lazyComponent(init), workInProgress2.flags |= 1, reconcileChildren(current, workInProgress2, lazyComponent, renderLanes2), workInProgress2.child;
          case 14:
            return updateMemoComponent(
              current,
              workInProgress2,
              workInProgress2.type,
              workInProgress2.pendingProps,
              renderLanes2
            );
          case 15:
            return updateSimpleMemoComponent(
              current,
              workInProgress2,
              workInProgress2.type,
              workInProgress2.pendingProps,
              renderLanes2
            );
          case 19:
            return updateSuspenseListComponent(current, workInProgress2, renderLanes2);
          case 22:
            return updateOffscreenComponent(current, workInProgress2, renderLanes2);
          case 24:
            return prepareToReadContext(workInProgress2), lazyComponent = readContext(CacheContext), null === current ? (init = peekCacheFromPool(), null === init && (init = workInProgressRoot, nextProps = createCache(), init.pooledCache = nextProps, nextProps.refCount++, null !== nextProps && (init.pooledCacheLanes |= renderLanes2), init = nextProps), workInProgress2.memoizedState = {
              parent: lazyComponent,
              cache: init
            }, initializeUpdateQueue(workInProgress2), pushProvider(workInProgress2, CacheContext, init)) : (0 !== (current.lanes & renderLanes2) && (cloneUpdateQueue(current, workInProgress2), processUpdateQueue(workInProgress2, null, null, renderLanes2), suspendIfUpdateReadFromEntangledAsyncAction()), init = current.memoizedState, nextProps = workInProgress2.memoizedState, init.parent !== lazyComponent ? (init = { parent: lazyComponent, cache: lazyComponent }, workInProgress2.memoizedState = init, 0 === workInProgress2.lanes && (workInProgress2.memoizedState = workInProgress2.updateQueue.baseState = init), pushProvider(workInProgress2, CacheContext, lazyComponent)) : (lazyComponent = nextProps.cache, pushProvider(workInProgress2, CacheContext, lazyComponent), lazyComponent !== init.cache && propagateContextChanges(
              workInProgress2,
              [CacheContext],
              renderLanes2,
              true
            ))), reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps.children,
              renderLanes2
            ), workInProgress2.child;
          case 29:
            throw workInProgress2.pendingProps;
        }
        throw Error(formatProdErrorMessage(156, workInProgress2.tag));
      }
      var valueCursor = createCursor(null);
      var currentlyRenderingFiber = null;
      var lastContextDependency = null;
      function pushProvider(providerFiber, context, nextValue) {
        push(valueCursor, context._currentValue);
        context._currentValue = nextValue;
      }
      function popProvider(context) {
        context._currentValue = valueCursor.current;
        pop(valueCursor);
      }
      function scheduleContextWorkOnParentPath(parent, renderLanes2, propagationRoot) {
        for (; null !== parent; ) {
          var alternate = parent.alternate;
          (parent.childLanes & renderLanes2) !== renderLanes2 ? (parent.childLanes |= renderLanes2, null !== alternate && (alternate.childLanes |= renderLanes2)) : null !== alternate && (alternate.childLanes & renderLanes2) !== renderLanes2 && (alternate.childLanes |= renderLanes2);
          if (parent === propagationRoot) break;
          parent = parent.return;
        }
      }
      function propagateContextChanges(workInProgress2, contexts, renderLanes2, forcePropagateEntireTree) {
        var fiber = workInProgress2.child;
        null !== fiber && (fiber.return = workInProgress2);
        for (; null !== fiber; ) {
          var list = fiber.dependencies;
          if (null !== list) {
            var nextFiber = fiber.child;
            list = list.firstContext;
            a: for (; null !== list; ) {
              var dependency = list;
              list = fiber;
              for (var i = 0; i < contexts.length; i++)
                if (dependency.context === contexts[i]) {
                  list.lanes |= renderLanes2;
                  dependency = list.alternate;
                  null !== dependency && (dependency.lanes |= renderLanes2);
                  scheduleContextWorkOnParentPath(
                    list.return,
                    renderLanes2,
                    workInProgress2
                  );
                  forcePropagateEntireTree || (nextFiber = null);
                  break a;
                }
              list = dependency.next;
            }
          } else if (18 === fiber.tag) {
            nextFiber = fiber.return;
            if (null === nextFiber) throw Error(formatProdErrorMessage(341));
            nextFiber.lanes |= renderLanes2;
            list = nextFiber.alternate;
            null !== list && (list.lanes |= renderLanes2);
            scheduleContextWorkOnParentPath(nextFiber, renderLanes2, workInProgress2);
            nextFiber = null;
          } else nextFiber = fiber.child;
          if (null !== nextFiber) nextFiber.return = fiber;
          else
            for (nextFiber = fiber; null !== nextFiber; ) {
              if (nextFiber === workInProgress2) {
                nextFiber = null;
                break;
              }
              fiber = nextFiber.sibling;
              if (null !== fiber) {
                fiber.return = nextFiber.return;
                nextFiber = fiber;
                break;
              }
              nextFiber = nextFiber.return;
            }
          fiber = nextFiber;
        }
      }
      function propagateParentContextChanges(current, workInProgress2, renderLanes2, forcePropagateEntireTree) {
        current = null;
        for (var parent = workInProgress2, isInsidePropagationBailout = false; null !== parent; ) {
          if (!isInsidePropagationBailout) {
            if (0 !== (parent.flags & 524288)) isInsidePropagationBailout = true;
            else if (0 !== (parent.flags & 262144)) break;
          }
          if (10 === parent.tag) {
            var currentParent = parent.alternate;
            if (null === currentParent) throw Error(formatProdErrorMessage(387));
            currentParent = currentParent.memoizedProps;
            if (null !== currentParent) {
              var context = parent.type;
              objectIs(parent.pendingProps.value, currentParent.value) || (null !== current ? current.push(context) : current = [context]);
            }
          } else if (parent === hostTransitionProviderCursor.current) {
            currentParent = parent.alternate;
            if (null === currentParent) throw Error(formatProdErrorMessage(387));
            currentParent.memoizedState.memoizedState !== parent.memoizedState.memoizedState && (null !== current ? current.push(HostTransitionContext) : current = [HostTransitionContext]);
          }
          parent = parent.return;
        }
        null !== current && propagateContextChanges(
          workInProgress2,
          current,
          renderLanes2,
          forcePropagateEntireTree
        );
        workInProgress2.flags |= 262144;
      }
      function checkIfContextChanged(currentDependencies) {
        for (currentDependencies = currentDependencies.firstContext; null !== currentDependencies; ) {
          if (!objectIs(
            currentDependencies.context._currentValue,
            currentDependencies.memoizedValue
          ))
            return true;
          currentDependencies = currentDependencies.next;
        }
        return false;
      }
      function prepareToReadContext(workInProgress2) {
        currentlyRenderingFiber = workInProgress2;
        lastContextDependency = null;
        workInProgress2 = workInProgress2.dependencies;
        null !== workInProgress2 && (workInProgress2.firstContext = null);
      }
      function readContext(context) {
        return readContextForConsumer(currentlyRenderingFiber, context);
      }
      function readContextDuringReconciliation(consumer, context) {
        null === currentlyRenderingFiber && prepareToReadContext(consumer);
        return readContextForConsumer(consumer, context);
      }
      function readContextForConsumer(consumer, context) {
        var value = context._currentValue;
        context = { context, memoizedValue: value, next: null };
        if (null === lastContextDependency) {
          if (null === consumer) throw Error(formatProdErrorMessage(308));
          lastContextDependency = context;
          consumer.dependencies = { lanes: 0, firstContext: context };
          consumer.flags |= 524288;
        } else lastContextDependency = lastContextDependency.next = context;
        return value;
      }
      var hasForceUpdate = false;
      function initializeUpdateQueue(fiber) {
        fiber.updateQueue = {
          baseState: fiber.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function cloneUpdateQueue(current, workInProgress2) {
        current = current.updateQueue;
        workInProgress2.updateQueue === current && (workInProgress2.updateQueue = {
          baseState: current.baseState,
          firstBaseUpdate: current.firstBaseUpdate,
          lastBaseUpdate: current.lastBaseUpdate,
          shared: current.shared,
          callbacks: null
        });
      }
      function createUpdate(lane) {
        return { lane, tag: 0, payload: null, callback: null, next: null };
      }
      function enqueueUpdate(fiber, update, lane) {
        var updateQueue = fiber.updateQueue;
        if (null === updateQueue) return null;
        updateQueue = updateQueue.shared;
        if (0 !== (executionContext & 2)) {
          var pending = updateQueue.pending;
          null === pending ? update.next = update : (update.next = pending.next, pending.next = update);
          updateQueue.pending = update;
          update = getRootForUpdatedFiber(fiber);
          markUpdateLaneFromFiberToRoot(fiber, null, lane);
          return update;
        }
        enqueueUpdate$1(fiber, updateQueue, update, lane);
        return getRootForUpdatedFiber(fiber);
      }
      function entangleTransitions(root2, fiber, lane) {
        fiber = fiber.updateQueue;
        if (null !== fiber && (fiber = fiber.shared, 0 !== (lane & 4194176))) {
          var queueLanes = fiber.lanes;
          queueLanes &= root2.pendingLanes;
          lane |= queueLanes;
          fiber.lanes = lane;
          markRootEntangled(root2, lane);
        }
      }
      function enqueueCapturedUpdate(workInProgress2, capturedUpdate) {
        var queue = workInProgress2.updateQueue, current = workInProgress2.alternate;
        if (null !== current && (current = current.updateQueue, queue === current)) {
          var newFirst = null, newLast = null;
          queue = queue.firstBaseUpdate;
          if (null !== queue) {
            do {
              var clone = {
                lane: queue.lane,
                tag: queue.tag,
                payload: queue.payload,
                callback: null,
                next: null
              };
              null === newLast ? newFirst = newLast = clone : newLast = newLast.next = clone;
              queue = queue.next;
            } while (null !== queue);
            null === newLast ? newFirst = newLast = capturedUpdate : newLast = newLast.next = capturedUpdate;
          } else newFirst = newLast = capturedUpdate;
          queue = {
            baseState: current.baseState,
            firstBaseUpdate: newFirst,
            lastBaseUpdate: newLast,
            shared: current.shared,
            callbacks: current.callbacks
          };
          workInProgress2.updateQueue = queue;
          return;
        }
        workInProgress2 = queue.lastBaseUpdate;
        null === workInProgress2 ? queue.firstBaseUpdate = capturedUpdate : workInProgress2.next = capturedUpdate;
        queue.lastBaseUpdate = capturedUpdate;
      }
      var didReadFromEntangledAsyncAction = false;
      function suspendIfUpdateReadFromEntangledAsyncAction() {
        if (didReadFromEntangledAsyncAction) {
          var entangledActionThenable = currentEntangledActionThenable;
          if (null !== entangledActionThenable) throw entangledActionThenable;
        }
      }
      function processUpdateQueue(workInProgress$jscomp$0, props, instance$jscomp$0, renderLanes2) {
        didReadFromEntangledAsyncAction = false;
        var queue = workInProgress$jscomp$0.updateQueue;
        hasForceUpdate = false;
        var firstBaseUpdate = queue.firstBaseUpdate, lastBaseUpdate = queue.lastBaseUpdate, pendingQueue = queue.shared.pending;
        if (null !== pendingQueue) {
          queue.shared.pending = null;
          var lastPendingUpdate = pendingQueue, firstPendingUpdate = lastPendingUpdate.next;
          lastPendingUpdate.next = null;
          null === lastBaseUpdate ? firstBaseUpdate = firstPendingUpdate : lastBaseUpdate.next = firstPendingUpdate;
          lastBaseUpdate = lastPendingUpdate;
          var current = workInProgress$jscomp$0.alternate;
          null !== current && (current = current.updateQueue, pendingQueue = current.lastBaseUpdate, pendingQueue !== lastBaseUpdate && (null === pendingQueue ? current.firstBaseUpdate = firstPendingUpdate : pendingQueue.next = firstPendingUpdate, current.lastBaseUpdate = lastPendingUpdate));
        }
        if (null !== firstBaseUpdate) {
          var newState = queue.baseState;
          lastBaseUpdate = 0;
          current = firstPendingUpdate = lastPendingUpdate = null;
          pendingQueue = firstBaseUpdate;
          do {
            var updateLane = pendingQueue.lane & -536870913, isHiddenUpdate = updateLane !== pendingQueue.lane;
            if (isHiddenUpdate ? (workInProgressRootRenderLanes & updateLane) === updateLane : (renderLanes2 & updateLane) === updateLane) {
              0 !== updateLane && updateLane === currentEntangledLane && (didReadFromEntangledAsyncAction = true);
              null !== current && (current = current.next = {
                lane: 0,
                tag: pendingQueue.tag,
                payload: pendingQueue.payload,
                callback: null,
                next: null
              });
              a: {
                var workInProgress2 = workInProgress$jscomp$0, update = pendingQueue;
                updateLane = props;
                var instance = instance$jscomp$0;
                switch (update.tag) {
                  case 1:
                    workInProgress2 = update.payload;
                    if ("function" === typeof workInProgress2) {
                      newState = workInProgress2.call(instance, newState, updateLane);
                      break a;
                    }
                    newState = workInProgress2;
                    break a;
                  case 3:
                    workInProgress2.flags = workInProgress2.flags & -65537 | 128;
                  case 0:
                    workInProgress2 = update.payload;
                    updateLane = "function" === typeof workInProgress2 ? workInProgress2.call(instance, newState, updateLane) : workInProgress2;
                    if (null === updateLane || void 0 === updateLane) break a;
                    newState = assign({}, newState, updateLane);
                    break a;
                  case 2:
                    hasForceUpdate = true;
                }
              }
              updateLane = pendingQueue.callback;
              null !== updateLane && (workInProgress$jscomp$0.flags |= 64, isHiddenUpdate && (workInProgress$jscomp$0.flags |= 8192), isHiddenUpdate = queue.callbacks, null === isHiddenUpdate ? queue.callbacks = [updateLane] : isHiddenUpdate.push(updateLane));
            } else
              isHiddenUpdate = {
                lane: updateLane,
                tag: pendingQueue.tag,
                payload: pendingQueue.payload,
                callback: pendingQueue.callback,
                next: null
              }, null === current ? (firstPendingUpdate = current = isHiddenUpdate, lastPendingUpdate = newState) : current = current.next = isHiddenUpdate, lastBaseUpdate |= updateLane;
            pendingQueue = pendingQueue.next;
            if (null === pendingQueue)
              if (pendingQueue = queue.shared.pending, null === pendingQueue)
                break;
              else
                isHiddenUpdate = pendingQueue, pendingQueue = isHiddenUpdate.next, isHiddenUpdate.next = null, queue.lastBaseUpdate = isHiddenUpdate, queue.shared.pending = null;
          } while (1);
          null === current && (lastPendingUpdate = newState);
          queue.baseState = lastPendingUpdate;
          queue.firstBaseUpdate = firstPendingUpdate;
          queue.lastBaseUpdate = current;
          null === firstBaseUpdate && (queue.shared.lanes = 0);
          workInProgressRootSkippedLanes |= lastBaseUpdate;
          workInProgress$jscomp$0.lanes = lastBaseUpdate;
          workInProgress$jscomp$0.memoizedState = newState;
        }
      }
      function callCallback(callback, context) {
        if ("function" !== typeof callback)
          throw Error(formatProdErrorMessage(191, callback));
        callback.call(context);
      }
      function commitCallbacks(updateQueue, context) {
        var callbacks = updateQueue.callbacks;
        if (null !== callbacks)
          for (updateQueue.callbacks = null, updateQueue = 0; updateQueue < callbacks.length; updateQueue++)
            callCallback(callbacks[updateQueue], context);
      }
      function commitHookEffectListMount(flags, finishedWork) {
        try {
          var updateQueue = finishedWork.updateQueue, lastEffect = null !== updateQueue ? updateQueue.lastEffect : null;
          if (null !== lastEffect) {
            var firstEffect = lastEffect.next;
            updateQueue = firstEffect;
            do {
              if ((updateQueue.tag & flags) === flags) {
                lastEffect = void 0;
                var create = updateQueue.create, inst = updateQueue.inst;
                lastEffect = create();
                inst.destroy = lastEffect;
              }
              updateQueue = updateQueue.next;
            } while (updateQueue !== firstEffect);
          }
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      function commitHookEffectListUnmount(flags, finishedWork, nearestMountedAncestor$jscomp$0) {
        try {
          var updateQueue = finishedWork.updateQueue, lastEffect = null !== updateQueue ? updateQueue.lastEffect : null;
          if (null !== lastEffect) {
            var firstEffect = lastEffect.next;
            updateQueue = firstEffect;
            do {
              if ((updateQueue.tag & flags) === flags) {
                var inst = updateQueue.inst, destroy = inst.destroy;
                if (void 0 !== destroy) {
                  inst.destroy = void 0;
                  lastEffect = finishedWork;
                  var nearestMountedAncestor = nearestMountedAncestor$jscomp$0;
                  try {
                    destroy();
                  } catch (error) {
                    captureCommitPhaseError(
                      lastEffect,
                      nearestMountedAncestor,
                      error
                    );
                  }
                }
              }
              updateQueue = updateQueue.next;
            } while (updateQueue !== firstEffect);
          }
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      function commitClassCallbacks(finishedWork) {
        var updateQueue = finishedWork.updateQueue;
        if (null !== updateQueue) {
          var instance = finishedWork.stateNode;
          try {
            commitCallbacks(updateQueue, instance);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
      }
      function safelyCallComponentWillUnmount(current, nearestMountedAncestor, instance) {
        instance.props = resolveClassComponentProps(
          current.type,
          current.memoizedProps
        );
        instance.state = current.memoizedState;
        try {
          instance.componentWillUnmount();
        } catch (error) {
          captureCommitPhaseError(current, nearestMountedAncestor, error);
        }
      }
      function safelyAttachRef(current, nearestMountedAncestor) {
        try {
          var ref = current.ref;
          if (null !== ref) {
            var instance = current.stateNode;
            switch (current.tag) {
              case 26:
              case 27:
              case 5:
                var instanceToUse = instance;
                break;
              default:
                instanceToUse = instance;
            }
            "function" === typeof ref ? current.refCleanup = ref(instanceToUse) : ref.current = instanceToUse;
          }
        } catch (error) {
          captureCommitPhaseError(current, nearestMountedAncestor, error);
        }
      }
      function safelyDetachRef(current, nearestMountedAncestor) {
        var ref = current.ref, refCleanup = current.refCleanup;
        if (null !== ref)
          if ("function" === typeof refCleanup)
            try {
              refCleanup();
            } catch (error) {
              captureCommitPhaseError(current, nearestMountedAncestor, error);
            } finally {
              current.refCleanup = null, current = current.alternate, null != current && (current.refCleanup = null);
            }
          else if ("function" === typeof ref)
            try {
              ref(null);
            } catch (error$112) {
              captureCommitPhaseError(current, nearestMountedAncestor, error$112);
            }
          else ref.current = null;
      }
      function commitHostMount(finishedWork) {
        var type2 = finishedWork.type, props = finishedWork.memoizedProps, instance = finishedWork.stateNode;
        try {
          a: switch (type2) {
            case "button":
            case "input":
            case "select":
            case "textarea":
              props.autoFocus && instance.focus();
              break a;
            case "img":
              props.src ? instance.src = props.src : props.srcSet && (instance.srcset = props.srcSet);
          }
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      function commitHostUpdate(finishedWork, newProps, oldProps) {
        try {
          var domElement = finishedWork.stateNode;
          updateProperties(domElement, finishedWork.type, oldProps, newProps);
          domElement[internalPropsKey] = newProps;
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      function isHostParent(fiber) {
        return 5 === fiber.tag || 3 === fiber.tag || 26 === fiber.tag || 27 === fiber.tag || 4 === fiber.tag;
      }
      function getHostSibling(fiber) {
        a: for (; ; ) {
          for (; null === fiber.sibling; ) {
            if (null === fiber.return || isHostParent(fiber.return)) return null;
            fiber = fiber.return;
          }
          fiber.sibling.return = fiber.return;
          for (fiber = fiber.sibling; 5 !== fiber.tag && 6 !== fiber.tag && 27 !== fiber.tag && 18 !== fiber.tag; ) {
            if (fiber.flags & 2) continue a;
            if (null === fiber.child || 4 === fiber.tag) continue a;
            else fiber.child.return = fiber, fiber = fiber.child;
          }
          if (!(fiber.flags & 2)) return fiber.stateNode;
        }
      }
      function insertOrAppendPlacementNodeIntoContainer(node, before, parent) {
        var tag = node.tag;
        if (5 === tag || 6 === tag)
          node = node.stateNode, before ? 8 === parent.nodeType ? parent.parentNode.insertBefore(node, before) : parent.insertBefore(node, before) : (8 === parent.nodeType ? (before = parent.parentNode, before.insertBefore(node, parent)) : (before = parent, before.appendChild(node)), parent = parent._reactRootContainer, null !== parent && void 0 !== parent || null !== before.onclick || (before.onclick = noop$1));
        else if (4 !== tag && 27 !== tag && (node = node.child, null !== node))
          for (insertOrAppendPlacementNodeIntoContainer(node, before, parent), node = node.sibling; null !== node; )
            insertOrAppendPlacementNodeIntoContainer(node, before, parent), node = node.sibling;
      }
      function insertOrAppendPlacementNode(node, before, parent) {
        var tag = node.tag;
        if (5 === tag || 6 === tag)
          node = node.stateNode, before ? parent.insertBefore(node, before) : parent.appendChild(node);
        else if (4 !== tag && 27 !== tag && (node = node.child, null !== node))
          for (insertOrAppendPlacementNode(node, before, parent), node = node.sibling; null !== node; )
            insertOrAppendPlacementNode(node, before, parent), node = node.sibling;
      }
      var offscreenSubtreeIsHidden = false;
      var offscreenSubtreeWasHidden = false;
      var needsFormReset = false;
      var PossiblyWeakSet = "function" === typeof WeakSet ? WeakSet : Set;
      var nextEffect = null;
      var shouldFireAfterActiveInstanceBlur = false;
      function commitBeforeMutationEffects(root2, firstChild) {
        root2 = root2.containerInfo;
        eventsEnabled = _enabled;
        root2 = getActiveElementDeep(root2);
        if (hasSelectionCapabilities(root2)) {
          if ("selectionStart" in root2)
            var JSCompiler_temp = {
              start: root2.selectionStart,
              end: root2.selectionEnd
            };
          else
            a: {
              JSCompiler_temp = (JSCompiler_temp = root2.ownerDocument) && JSCompiler_temp.defaultView || window;
              var selection = JSCompiler_temp.getSelection && JSCompiler_temp.getSelection();
              if (selection && 0 !== selection.rangeCount) {
                JSCompiler_temp = selection.anchorNode;
                var anchorOffset = selection.anchorOffset, focusNode = selection.focusNode;
                selection = selection.focusOffset;
                try {
                  JSCompiler_temp.nodeType, focusNode.nodeType;
                } catch (e$20) {
                  JSCompiler_temp = null;
                  break a;
                }
                var length = 0, start = -1, end = -1, indexWithinAnchor = 0, indexWithinFocus = 0, node = root2, parentNode = null;
                b: for (; ; ) {
                  for (var next; ; ) {
                    node !== JSCompiler_temp || 0 !== anchorOffset && 3 !== node.nodeType || (start = length + anchorOffset);
                    node !== focusNode || 0 !== selection && 3 !== node.nodeType || (end = length + selection);
                    3 === node.nodeType && (length += node.nodeValue.length);
                    if (null === (next = node.firstChild)) break;
                    parentNode = node;
                    node = next;
                  }
                  for (; ; ) {
                    if (node === root2) break b;
                    parentNode === JSCompiler_temp && ++indexWithinAnchor === anchorOffset && (start = length);
                    parentNode === focusNode && ++indexWithinFocus === selection && (end = length);
                    if (null !== (next = node.nextSibling)) break;
                    node = parentNode;
                    parentNode = node.parentNode;
                  }
                  node = next;
                }
                JSCompiler_temp = -1 === start || -1 === end ? null : { start, end };
              } else JSCompiler_temp = null;
            }
          JSCompiler_temp = JSCompiler_temp || { start: 0, end: 0 };
        } else JSCompiler_temp = null;
        selectionInformation = { focusedElem: root2, selectionRange: JSCompiler_temp };
        _enabled = false;
        for (nextEffect = firstChild; null !== nextEffect; )
          if (firstChild = nextEffect, root2 = firstChild.child, 0 !== (firstChild.subtreeFlags & 1028) && null !== root2)
            root2.return = firstChild, nextEffect = root2;
          else
            for (; null !== nextEffect; ) {
              firstChild = nextEffect;
              focusNode = firstChild.alternate;
              root2 = firstChild.flags;
              switch (firstChild.tag) {
                case 0:
                  break;
                case 11:
                case 15:
                  break;
                case 1:
                  if (0 !== (root2 & 1024) && null !== focusNode) {
                    root2 = void 0;
                    JSCompiler_temp = firstChild;
                    anchorOffset = focusNode.memoizedProps;
                    focusNode = focusNode.memoizedState;
                    selection = JSCompiler_temp.stateNode;
                    try {
                      var resolvedPrevProps = resolveClassComponentProps(
                        JSCompiler_temp.type,
                        anchorOffset,
                        JSCompiler_temp.elementType === JSCompiler_temp.type
                      );
                      root2 = selection.getSnapshotBeforeUpdate(
                        resolvedPrevProps,
                        focusNode
                      );
                      selection.__reactInternalSnapshotBeforeUpdate = root2;
                    } catch (error) {
                      captureCommitPhaseError(
                        JSCompiler_temp,
                        JSCompiler_temp.return,
                        error
                      );
                    }
                  }
                  break;
                case 3:
                  if (0 !== (root2 & 1024)) {
                    if (root2 = firstChild.stateNode.containerInfo, JSCompiler_temp = root2.nodeType, 9 === JSCompiler_temp)
                      clearContainerSparingly(root2);
                    else if (1 === JSCompiler_temp)
                      switch (root2.nodeName) {
                        case "HEAD":
                        case "HTML":
                        case "BODY":
                          clearContainerSparingly(root2);
                          break;
                        default:
                          root2.textContent = "";
                      }
                  }
                  break;
                case 5:
                case 26:
                case 27:
                case 6:
                case 4:
                case 17:
                  break;
                default:
                  if (0 !== (root2 & 1024)) throw Error(formatProdErrorMessage(163));
              }
              root2 = firstChild.sibling;
              if (null !== root2) {
                root2.return = firstChild.return;
                nextEffect = root2;
                break;
              }
              nextEffect = firstChild.return;
            }
        resolvedPrevProps = shouldFireAfterActiveInstanceBlur;
        shouldFireAfterActiveInstanceBlur = false;
        return resolvedPrevProps;
      }
      function commitLayoutEffectOnFiber(finishedRoot, current, finishedWork) {
        var flags = finishedWork.flags;
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 15:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            flags & 4 && commitHookEffectListMount(5, finishedWork);
            break;
          case 1:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            if (flags & 4)
              if (finishedRoot = finishedWork.stateNode, null === current)
                try {
                  finishedRoot.componentDidMount();
                } catch (error) {
                  captureCommitPhaseError(finishedWork, finishedWork.return, error);
                }
              else {
                var prevProps = resolveClassComponentProps(
                  finishedWork.type,
                  current.memoizedProps
                );
                current = current.memoizedState;
                try {
                  finishedRoot.componentDidUpdate(
                    prevProps,
                    current,
                    finishedRoot.__reactInternalSnapshotBeforeUpdate
                  );
                } catch (error$111) {
                  captureCommitPhaseError(
                    finishedWork,
                    finishedWork.return,
                    error$111
                  );
                }
              }
            flags & 64 && commitClassCallbacks(finishedWork);
            flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
            break;
          case 3:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            if (flags & 64 && (flags = finishedWork.updateQueue, null !== flags)) {
              finishedRoot = null;
              if (null !== finishedWork.child)
                switch (finishedWork.child.tag) {
                  case 27:
                  case 5:
                    finishedRoot = finishedWork.child.stateNode;
                    break;
                  case 1:
                    finishedRoot = finishedWork.child.stateNode;
                }
              try {
                commitCallbacks(flags, finishedRoot);
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            }
            break;
          case 26:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
            break;
          case 27:
          case 5:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            null === current && flags & 4 && commitHostMount(finishedWork);
            flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
            break;
          case 12:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            break;
          case 13:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            flags & 4 && commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
            break;
          case 22:
            prevProps = null !== finishedWork.memoizedState || offscreenSubtreeIsHidden;
            if (!prevProps) {
              current = null !== current && null !== current.memoizedState || offscreenSubtreeWasHidden;
              var prevOffscreenSubtreeIsHidden = offscreenSubtreeIsHidden, prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
              offscreenSubtreeIsHidden = prevProps;
              (offscreenSubtreeWasHidden = current) && !prevOffscreenSubtreeWasHidden ? recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                0 !== (finishedWork.subtreeFlags & 8772)
              ) : recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
              offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden;
              offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
            }
            flags & 512 && ("manual" === finishedWork.memoizedProps.mode ? safelyAttachRef(finishedWork, finishedWork.return) : safelyDetachRef(finishedWork, finishedWork.return));
            break;
          default:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
        }
      }
      function detachFiberAfterEffects(fiber) {
        var alternate = fiber.alternate;
        null !== alternate && (fiber.alternate = null, detachFiberAfterEffects(alternate));
        fiber.child = null;
        fiber.deletions = null;
        fiber.sibling = null;
        5 === fiber.tag && (alternate = fiber.stateNode, null !== alternate && detachDeletedInstance(alternate));
        fiber.stateNode = null;
        fiber.return = null;
        fiber.dependencies = null;
        fiber.memoizedProps = null;
        fiber.memoizedState = null;
        fiber.pendingProps = null;
        fiber.stateNode = null;
        fiber.updateQueue = null;
      }
      var hostParent = null;
      var hostParentIsContainer = false;
      function recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, parent) {
        for (parent = parent.child; null !== parent; )
          commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, parent), parent = parent.sibling;
      }
      function commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, deletedFiber) {
        if (injectedHook && "function" === typeof injectedHook.onCommitFiberUnmount)
          try {
            injectedHook.onCommitFiberUnmount(rendererID, deletedFiber);
          } catch (err) {
          }
        switch (deletedFiber.tag) {
          case 26:
            offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            deletedFiber.memoizedState ? deletedFiber.memoizedState.count-- : deletedFiber.stateNode && (deletedFiber = deletedFiber.stateNode, deletedFiber.parentNode.removeChild(deletedFiber));
            break;
          case 27:
            offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
            var prevHostParent = hostParent, prevHostParentIsContainer = hostParentIsContainer;
            hostParent = deletedFiber.stateNode;
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            deletedFiber = deletedFiber.stateNode;
            for (nearestMountedAncestor = deletedFiber.attributes; nearestMountedAncestor.length; )
              deletedFiber.removeAttributeNode(nearestMountedAncestor[0]);
            detachDeletedInstance(deletedFiber);
            hostParent = prevHostParent;
            hostParentIsContainer = prevHostParentIsContainer;
            break;
          case 5:
            offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
          case 6:
            prevHostParentIsContainer = hostParent;
            var prevHostParentIsContainer$119 = hostParentIsContainer;
            hostParent = null;
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            hostParent = prevHostParentIsContainer;
            hostParentIsContainer = prevHostParentIsContainer$119;
            if (null !== hostParent)
              if (hostParentIsContainer)
                try {
                  finishedRoot = hostParent, prevHostParent = deletedFiber.stateNode, 8 === finishedRoot.nodeType ? finishedRoot.parentNode.removeChild(prevHostParent) : finishedRoot.removeChild(prevHostParent);
                } catch (error) {
                  captureCommitPhaseError(
                    deletedFiber,
                    nearestMountedAncestor,
                    error
                  );
                }
              else
                try {
                  hostParent.removeChild(deletedFiber.stateNode);
                } catch (error) {
                  captureCommitPhaseError(
                    deletedFiber,
                    nearestMountedAncestor,
                    error
                  );
                }
            break;
          case 18:
            null !== hostParent && (hostParentIsContainer ? (nearestMountedAncestor = hostParent, deletedFiber = deletedFiber.stateNode, 8 === nearestMountedAncestor.nodeType ? clearSuspenseBoundary(
              nearestMountedAncestor.parentNode,
              deletedFiber
            ) : 1 === nearestMountedAncestor.nodeType && clearSuspenseBoundary(nearestMountedAncestor, deletedFiber), retryIfBlockedOn(nearestMountedAncestor)) : clearSuspenseBoundary(hostParent, deletedFiber.stateNode));
            break;
          case 4:
            prevHostParent = hostParent;
            prevHostParentIsContainer = hostParentIsContainer;
            hostParent = deletedFiber.stateNode.containerInfo;
            hostParentIsContainer = true;
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            hostParent = prevHostParent;
            hostParentIsContainer = prevHostParentIsContainer;
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            offscreenSubtreeWasHidden || commitHookEffectListUnmount(2, deletedFiber, nearestMountedAncestor);
            offscreenSubtreeWasHidden || commitHookEffectListUnmount(4, deletedFiber, nearestMountedAncestor);
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            break;
          case 1:
            offscreenSubtreeWasHidden || (safelyDetachRef(deletedFiber, nearestMountedAncestor), prevHostParent = deletedFiber.stateNode, "function" === typeof prevHostParent.componentWillUnmount && safelyCallComponentWillUnmount(
              deletedFiber,
              nearestMountedAncestor,
              prevHostParent
            ));
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            break;
          case 21:
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            break;
          case 22:
            offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
            offscreenSubtreeWasHidden = (prevHostParent = offscreenSubtreeWasHidden) || null !== deletedFiber.memoizedState;
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            offscreenSubtreeWasHidden = prevHostParent;
            break;
          default:
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
        }
      }
      function commitSuspenseHydrationCallbacks(finishedRoot, finishedWork) {
        if (null === finishedWork.memoizedState && (finishedRoot = finishedWork.alternate, null !== finishedRoot && (finishedRoot = finishedRoot.memoizedState, null !== finishedRoot && (finishedRoot = finishedRoot.dehydrated, null !== finishedRoot))))
          try {
            retryIfBlockedOn(finishedRoot);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
      }
      function getRetryCache(finishedWork) {
        switch (finishedWork.tag) {
          case 13:
          case 19:
            var retryCache = finishedWork.stateNode;
            null === retryCache && (retryCache = finishedWork.stateNode = new PossiblyWeakSet());
            return retryCache;
          case 22:
            return finishedWork = finishedWork.stateNode, retryCache = finishedWork._retryCache, null === retryCache && (retryCache = finishedWork._retryCache = new PossiblyWeakSet()), retryCache;
          default:
            throw Error(formatProdErrorMessage(435, finishedWork.tag));
        }
      }
      function attachSuspenseRetryListeners(finishedWork, wakeables) {
        var retryCache = getRetryCache(finishedWork);
        wakeables.forEach(function(wakeable) {
          var retry = resolveRetryWakeable.bind(null, finishedWork, wakeable);
          retryCache.has(wakeable) || (retryCache.add(wakeable), wakeable.then(retry, retry));
        });
      }
      function recursivelyTraverseMutationEffects(root$jscomp$0, parentFiber) {
        var deletions = parentFiber.deletions;
        if (null !== deletions)
          for (var i = 0; i < deletions.length; i++) {
            var childToDelete = deletions[i], root2 = root$jscomp$0, returnFiber = parentFiber, parent = returnFiber;
            a: for (; null !== parent; ) {
              switch (parent.tag) {
                case 27:
                case 5:
                  hostParent = parent.stateNode;
                  hostParentIsContainer = false;
                  break a;
                case 3:
                  hostParent = parent.stateNode.containerInfo;
                  hostParentIsContainer = true;
                  break a;
                case 4:
                  hostParent = parent.stateNode.containerInfo;
                  hostParentIsContainer = true;
                  break a;
              }
              parent = parent.return;
            }
            if (null === hostParent) throw Error(formatProdErrorMessage(160));
            commitDeletionEffectsOnFiber(root2, returnFiber, childToDelete);
            hostParent = null;
            hostParentIsContainer = false;
            root2 = childToDelete.alternate;
            null !== root2 && (root2.return = null);
            childToDelete.return = null;
          }
        if (parentFiber.subtreeFlags & 13878)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitMutationEffectsOnFiber(parentFiber, root$jscomp$0), parentFiber = parentFiber.sibling;
      }
      var currentHoistableRoot = null;
      function commitMutationEffectsOnFiber(finishedWork, root2) {
        var current = finishedWork.alternate, flags = finishedWork.flags;
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            flags & 4 && (commitHookEffectListUnmount(3, finishedWork, finishedWork.return), commitHookEffectListMount(3, finishedWork), commitHookEffectListUnmount(5, finishedWork, finishedWork.return));
            break;
          case 1:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            flags & 64 && offscreenSubtreeIsHidden && (finishedWork = finishedWork.updateQueue, null !== finishedWork && (flags = finishedWork.callbacks, null !== flags && (current = finishedWork.shared.hiddenCallbacks, finishedWork.shared.hiddenCallbacks = null === current ? flags : current.concat(flags))));
            break;
          case 26:
            var hoistableRoot = currentHoistableRoot;
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            if (flags & 4) {
              var currentResource = null !== current ? current.memoizedState : null;
              flags = finishedWork.memoizedState;
              if (null === current)
                if (null === flags)
                  if (null === finishedWork.stateNode) {
                    a: {
                      flags = finishedWork.type;
                      current = finishedWork.memoizedProps;
                      hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
                      b: switch (flags) {
                        case "title":
                          currentResource = hoistableRoot.getElementsByTagName("title")[0];
                          if (!currentResource || currentResource[internalHoistableMarker] || currentResource[internalInstanceKey] || "http://www.w3.org/2000/svg" === currentResource.namespaceURI || currentResource.hasAttribute("itemprop"))
                            currentResource = hoistableRoot.createElement(flags), hoistableRoot.head.insertBefore(
                              currentResource,
                              hoistableRoot.querySelector("head > title")
                            );
                          setInitialProperties(currentResource, flags, current);
                          currentResource[internalInstanceKey] = finishedWork;
                          markNodeAsHoistable(currentResource);
                          flags = currentResource;
                          break a;
                        case "link":
                          var maybeNodes = getHydratableHoistableCache(
                            "link",
                            "href",
                            hoistableRoot
                          ).get(flags + (current.href || ""));
                          if (maybeNodes) {
                            for (var i = 0; i < maybeNodes.length; i++)
                              if (currentResource = maybeNodes[i], currentResource.getAttribute("href") === (null == current.href ? null : current.href) && currentResource.getAttribute("rel") === (null == current.rel ? null : current.rel) && currentResource.getAttribute("title") === (null == current.title ? null : current.title) && currentResource.getAttribute("crossorigin") === (null == current.crossOrigin ? null : current.crossOrigin)) {
                                maybeNodes.splice(i, 1);
                                break b;
                              }
                          }
                          currentResource = hoistableRoot.createElement(flags);
                          setInitialProperties(currentResource, flags, current);
                          hoistableRoot.head.appendChild(currentResource);
                          break;
                        case "meta":
                          if (maybeNodes = getHydratableHoistableCache(
                            "meta",
                            "content",
                            hoistableRoot
                          ).get(flags + (current.content || ""))) {
                            for (i = 0; i < maybeNodes.length; i++)
                              if (currentResource = maybeNodes[i], currentResource.getAttribute("content") === (null == current.content ? null : "" + current.content) && currentResource.getAttribute("name") === (null == current.name ? null : current.name) && currentResource.getAttribute("property") === (null == current.property ? null : current.property) && currentResource.getAttribute("http-equiv") === (null == current.httpEquiv ? null : current.httpEquiv) && currentResource.getAttribute("charset") === (null == current.charSet ? null : current.charSet)) {
                                maybeNodes.splice(i, 1);
                                break b;
                              }
                          }
                          currentResource = hoistableRoot.createElement(flags);
                          setInitialProperties(currentResource, flags, current);
                          hoistableRoot.head.appendChild(currentResource);
                          break;
                        default:
                          throw Error(formatProdErrorMessage(468, flags));
                      }
                      currentResource[internalInstanceKey] = finishedWork;
                      markNodeAsHoistable(currentResource);
                      flags = currentResource;
                    }
                    finishedWork.stateNode = flags;
                  } else
                    mountHoistable(
                      hoistableRoot,
                      finishedWork.type,
                      finishedWork.stateNode
                    );
                else
                  finishedWork.stateNode = acquireResource(
                    hoistableRoot,
                    flags,
                    finishedWork.memoizedProps
                  );
              else
                currentResource !== flags ? (null === currentResource ? null !== current.stateNode && (current = current.stateNode, current.parentNode.removeChild(current)) : currentResource.count--, null === flags ? mountHoistable(
                  hoistableRoot,
                  finishedWork.type,
                  finishedWork.stateNode
                ) : acquireResource(
                  hoistableRoot,
                  flags,
                  finishedWork.memoizedProps
                )) : null === flags && null !== finishedWork.stateNode && commitHostUpdate(
                  finishedWork,
                  finishedWork.memoizedProps,
                  current.memoizedProps
                );
            }
            break;
          case 27:
            if (flags & 4 && null === finishedWork.alternate) {
              hoistableRoot = finishedWork.stateNode;
              currentResource = finishedWork.memoizedProps;
              try {
                for (var node = hoistableRoot.firstChild; node; ) {
                  var nextNode = node.nextSibling, nodeName = node.nodeName;
                  node[internalHoistableMarker] || "HEAD" === nodeName || "BODY" === nodeName || "SCRIPT" === nodeName || "STYLE" === nodeName || "LINK" === nodeName && "stylesheet" === node.rel.toLowerCase() || hoistableRoot.removeChild(node);
                  node = nextNode;
                }
                for (var type2 = finishedWork.type, attributes = hoistableRoot.attributes; attributes.length; )
                  hoistableRoot.removeAttributeNode(attributes[0]);
                setInitialProperties(hoistableRoot, type2, currentResource);
                hoistableRoot[internalInstanceKey] = finishedWork;
                hoistableRoot[internalPropsKey] = currentResource;
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            }
          case 5:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            if (finishedWork.flags & 32) {
              hoistableRoot = finishedWork.stateNode;
              try {
                setTextContent(hoistableRoot, "");
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            }
            flags & 4 && null != finishedWork.stateNode && (hoistableRoot = finishedWork.memoizedProps, commitHostUpdate(
              finishedWork,
              hoistableRoot,
              null !== current ? current.memoizedProps : hoistableRoot
            ));
            flags & 1024 && (needsFormReset = true);
            break;
          case 6:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            if (flags & 4) {
              if (null === finishedWork.stateNode)
                throw Error(formatProdErrorMessage(162));
              flags = finishedWork.memoizedProps;
              current = finishedWork.stateNode;
              try {
                current.nodeValue = flags;
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            }
            break;
          case 3:
            tagCaches = null;
            hoistableRoot = currentHoistableRoot;
            currentHoistableRoot = getHoistableRoot(root2.containerInfo);
            recursivelyTraverseMutationEffects(root2, finishedWork);
            currentHoistableRoot = hoistableRoot;
            commitReconciliationEffects(finishedWork);
            if (flags & 4 && null !== current && current.memoizedState.isDehydrated)
              try {
                retryIfBlockedOn(root2.containerInfo);
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            needsFormReset && (needsFormReset = false, recursivelyResetForms(finishedWork));
            break;
          case 4:
            flags = currentHoistableRoot;
            currentHoistableRoot = getHoistableRoot(
              finishedWork.stateNode.containerInfo
            );
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            currentHoistableRoot = flags;
            break;
          case 12:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            break;
          case 13:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            finishedWork.child.flags & 8192 && null !== finishedWork.memoizedState !== (null !== current && null !== current.memoizedState) && (globalMostRecentFallbackTime = now());
            flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
            break;
          case 22:
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            node = null !== finishedWork.memoizedState;
            nextNode = null !== current && null !== current.memoizedState;
            nodeName = offscreenSubtreeIsHidden;
            type2 = offscreenSubtreeWasHidden;
            offscreenSubtreeIsHidden = nodeName || node;
            offscreenSubtreeWasHidden = type2 || nextNode;
            recursivelyTraverseMutationEffects(root2, finishedWork);
            offscreenSubtreeWasHidden = type2;
            offscreenSubtreeIsHidden = nodeName;
            commitReconciliationEffects(finishedWork);
            root2 = finishedWork.stateNode;
            root2._current = finishedWork;
            root2._visibility &= -3;
            root2._visibility |= root2._pendingVisibility & 2;
            if (flags & 8192 && (root2._visibility = node ? root2._visibility & -2 : root2._visibility | 1, node && (root2 = offscreenSubtreeIsHidden || offscreenSubtreeWasHidden, null === current || nextNode || root2 || recursivelyTraverseDisappearLayoutEffects(finishedWork)), null === finishedWork.memoizedProps || "manual" !== finishedWork.memoizedProps.mode))
              a: for (current = null, root2 = finishedWork; ; ) {
                if (5 === root2.tag || 26 === root2.tag || 27 === root2.tag) {
                  if (null === current) {
                    nextNode = current = root2;
                    try {
                      if (hoistableRoot = nextNode.stateNode, node)
                        currentResource = hoistableRoot.style, "function" === typeof currentResource.setProperty ? currentResource.setProperty(
                          "display",
                          "none",
                          "important"
                        ) : currentResource.display = "none";
                      else {
                        maybeNodes = nextNode.stateNode;
                        i = nextNode.memoizedProps.style;
                        var display = void 0 !== i && null !== i && i.hasOwnProperty("display") ? i.display : null;
                        maybeNodes.style.display = null == display || "boolean" === typeof display ? "" : ("" + display).trim();
                      }
                    } catch (error) {
                      captureCommitPhaseError(nextNode, nextNode.return, error);
                    }
                  }
                } else if (6 === root2.tag) {
                  if (null === current) {
                    nextNode = root2;
                    try {
                      nextNode.stateNode.nodeValue = node ? "" : nextNode.memoizedProps;
                    } catch (error) {
                      captureCommitPhaseError(nextNode, nextNode.return, error);
                    }
                  }
                } else if ((22 !== root2.tag && 23 !== root2.tag || null === root2.memoizedState || root2 === finishedWork) && null !== root2.child) {
                  root2.child.return = root2;
                  root2 = root2.child;
                  continue;
                }
                if (root2 === finishedWork) break a;
                for (; null === root2.sibling; ) {
                  if (null === root2.return || root2.return === finishedWork) break a;
                  current === root2 && (current = null);
                  root2 = root2.return;
                }
                current === root2 && (current = null);
                root2.sibling.return = root2.return;
                root2 = root2.sibling;
              }
            flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (current = flags.retryQueue, null !== current && (flags.retryQueue = null, attachSuspenseRetryListeners(finishedWork, current))));
            break;
          case 19:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
            break;
          case 21:
            break;
          default:
            recursivelyTraverseMutationEffects(root2, finishedWork), commitReconciliationEffects(finishedWork);
        }
      }
      function commitReconciliationEffects(finishedWork) {
        var flags = finishedWork.flags;
        if (flags & 2) {
          try {
            if (27 !== finishedWork.tag) {
              a: {
                for (var parent = finishedWork.return; null !== parent; ) {
                  if (isHostParent(parent)) {
                    var JSCompiler_inline_result = parent;
                    break a;
                  }
                  parent = parent.return;
                }
                throw Error(formatProdErrorMessage(160));
              }
              switch (JSCompiler_inline_result.tag) {
                case 27:
                  var parent$jscomp$0 = JSCompiler_inline_result.stateNode, before = getHostSibling(finishedWork);
                  insertOrAppendPlacementNode(finishedWork, before, parent$jscomp$0);
                  break;
                case 5:
                  var parent$113 = JSCompiler_inline_result.stateNode;
                  JSCompiler_inline_result.flags & 32 && (setTextContent(parent$113, ""), JSCompiler_inline_result.flags &= -33);
                  var before$114 = getHostSibling(finishedWork);
                  insertOrAppendPlacementNode(finishedWork, before$114, parent$113);
                  break;
                case 3:
                case 4:
                  var parent$115 = JSCompiler_inline_result.stateNode.containerInfo, before$116 = getHostSibling(finishedWork);
                  insertOrAppendPlacementNodeIntoContainer(
                    finishedWork,
                    before$116,
                    parent$115
                  );
                  break;
                default:
                  throw Error(formatProdErrorMessage(161));
              }
            }
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
          finishedWork.flags &= -3;
        }
        flags & 4096 && (finishedWork.flags &= -4097);
      }
      function recursivelyResetForms(parentFiber) {
        if (parentFiber.subtreeFlags & 1024)
          for (parentFiber = parentFiber.child; null !== parentFiber; ) {
            var fiber = parentFiber;
            recursivelyResetForms(fiber);
            5 === fiber.tag && fiber.flags & 1024 && fiber.stateNode.reset();
            parentFiber = parentFiber.sibling;
          }
      }
      function recursivelyTraverseLayoutEffects(root2, parentFiber) {
        if (parentFiber.subtreeFlags & 8772)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitLayoutEffectOnFiber(root2, parentFiber.alternate, parentFiber), parentFiber = parentFiber.sibling;
      }
      function recursivelyTraverseDisappearLayoutEffects(parentFiber) {
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          var finishedWork = parentFiber;
          switch (finishedWork.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              commitHookEffectListUnmount(4, finishedWork, finishedWork.return);
              recursivelyTraverseDisappearLayoutEffects(finishedWork);
              break;
            case 1:
              safelyDetachRef(finishedWork, finishedWork.return);
              var instance = finishedWork.stateNode;
              "function" === typeof instance.componentWillUnmount && safelyCallComponentWillUnmount(
                finishedWork,
                finishedWork.return,
                instance
              );
              recursivelyTraverseDisappearLayoutEffects(finishedWork);
              break;
            case 26:
            case 27:
            case 5:
              safelyDetachRef(finishedWork, finishedWork.return);
              recursivelyTraverseDisappearLayoutEffects(finishedWork);
              break;
            case 22:
              safelyDetachRef(finishedWork, finishedWork.return);
              null === finishedWork.memoizedState && recursivelyTraverseDisappearLayoutEffects(finishedWork);
              break;
            default:
              recursivelyTraverseDisappearLayoutEffects(finishedWork);
          }
          parentFiber = parentFiber.sibling;
        }
      }
      function recursivelyTraverseReappearLayoutEffects(finishedRoot$jscomp$0, parentFiber, includeWorkInProgressEffects) {
        includeWorkInProgressEffects = includeWorkInProgressEffects && 0 !== (parentFiber.subtreeFlags & 8772);
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          var current = parentFiber.alternate, finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, flags = finishedWork.flags;
          switch (finishedWork.tag) {
            case 0:
            case 11:
            case 15:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
              commitHookEffectListMount(4, finishedWork);
              break;
            case 1:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
              current = finishedWork;
              finishedRoot = current.stateNode;
              if ("function" === typeof finishedRoot.componentDidMount)
                try {
                  finishedRoot.componentDidMount();
                } catch (error) {
                  captureCommitPhaseError(current, current.return, error);
                }
              current = finishedWork;
              finishedRoot = current.updateQueue;
              if (null !== finishedRoot) {
                var instance = current.stateNode;
                try {
                  var hiddenCallbacks = finishedRoot.shared.hiddenCallbacks;
                  if (null !== hiddenCallbacks)
                    for (finishedRoot.shared.hiddenCallbacks = null, finishedRoot = 0; finishedRoot < hiddenCallbacks.length; finishedRoot++)
                      callCallback(hiddenCallbacks[finishedRoot], instance);
                } catch (error) {
                  captureCommitPhaseError(current, current.return, error);
                }
              }
              includeWorkInProgressEffects && flags & 64 && commitClassCallbacks(finishedWork);
              safelyAttachRef(finishedWork, finishedWork.return);
              break;
            case 26:
            case 27:
            case 5:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
              includeWorkInProgressEffects && null === current && flags & 4 && commitHostMount(finishedWork);
              safelyAttachRef(finishedWork, finishedWork.return);
              break;
            case 12:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
              break;
            case 13:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
              includeWorkInProgressEffects && flags & 4 && commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
              break;
            case 22:
              null === finishedWork.memoizedState && recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
              safelyAttachRef(finishedWork, finishedWork.return);
              break;
            default:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
          }
          parentFiber = parentFiber.sibling;
        }
      }
      function commitOffscreenPassiveMountEffects(current, finishedWork) {
        var previousCache = null;
        null !== current && null !== current.memoizedState && null !== current.memoizedState.cachePool && (previousCache = current.memoizedState.cachePool.pool);
        current = null;
        null !== finishedWork.memoizedState && null !== finishedWork.memoizedState.cachePool && (current = finishedWork.memoizedState.cachePool.pool);
        current !== previousCache && (null != current && current.refCount++, null != previousCache && releaseCache(previousCache));
      }
      function commitCachePassiveMountEffect(current, finishedWork) {
        current = null;
        null !== finishedWork.alternate && (current = finishedWork.alternate.memoizedState.cache);
        finishedWork = finishedWork.memoizedState.cache;
        finishedWork !== current && (finishedWork.refCount++, null != current && releaseCache(current));
      }
      function recursivelyTraversePassiveMountEffects(root2, parentFiber, committedLanes, committedTransitions) {
        if (parentFiber.subtreeFlags & 10256)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitPassiveMountOnFiber(
              root2,
              parentFiber,
              committedLanes,
              committedTransitions
            ), parentFiber = parentFiber.sibling;
      }
      function commitPassiveMountOnFiber(finishedRoot, finishedWork, committedLanes, committedTransitions) {
        var flags = finishedWork.flags;
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 15:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            flags & 2048 && commitHookEffectListMount(9, finishedWork);
            break;
          case 3:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            flags & 2048 && (finishedRoot = null, null !== finishedWork.alternate && (finishedRoot = finishedWork.alternate.memoizedState.cache), finishedWork = finishedWork.memoizedState.cache, finishedWork !== finishedRoot && (finishedWork.refCount++, null != finishedRoot && releaseCache(finishedRoot)));
            break;
          case 12:
            if (flags & 2048) {
              recursivelyTraversePassiveMountEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions
              );
              finishedRoot = finishedWork.stateNode;
              try {
                var _finishedWork$memoize2 = finishedWork.memoizedProps, id = _finishedWork$memoize2.id, onPostCommit = _finishedWork$memoize2.onPostCommit;
                "function" === typeof onPostCommit && onPostCommit(
                  id,
                  null === finishedWork.alternate ? "mount" : "update",
                  finishedRoot.passiveEffectDuration,
                  -0
                );
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            } else
              recursivelyTraversePassiveMountEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions
              );
            break;
          case 23:
            break;
          case 22:
            _finishedWork$memoize2 = finishedWork.stateNode;
            null !== finishedWork.memoizedState ? _finishedWork$memoize2._visibility & 4 ? recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            ) : recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork) : _finishedWork$memoize2._visibility & 4 ? recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            ) : (_finishedWork$memoize2._visibility |= 4, recursivelyTraverseReconnectPassiveEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions,
              0 !== (finishedWork.subtreeFlags & 10256)
            ));
            flags & 2048 && commitOffscreenPassiveMountEffects(
              finishedWork.alternate,
              finishedWork
            );
            break;
          case 24:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
            break;
          default:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
        }
      }
      function recursivelyTraverseReconnectPassiveEffects(finishedRoot$jscomp$0, parentFiber, committedLanes$jscomp$0, committedTransitions$jscomp$0, includeWorkInProgressEffects) {
        includeWorkInProgressEffects = includeWorkInProgressEffects && 0 !== (parentFiber.subtreeFlags & 10256);
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          var finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, committedLanes = committedLanes$jscomp$0, committedTransitions = committedTransitions$jscomp$0, flags = finishedWork.flags;
          switch (finishedWork.tag) {
            case 0:
            case 11:
            case 15:
              recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              );
              commitHookEffectListMount(8, finishedWork);
              break;
            case 23:
              break;
            case 22:
              var instance = finishedWork.stateNode;
              null !== finishedWork.memoizedState ? instance._visibility & 4 ? recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              ) : recursivelyTraverseAtomicPassiveEffects(
                finishedRoot,
                finishedWork
              ) : (instance._visibility |= 4, recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              ));
              includeWorkInProgressEffects && flags & 2048 && commitOffscreenPassiveMountEffects(
                finishedWork.alternate,
                finishedWork
              );
              break;
            case 24:
              recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              );
              includeWorkInProgressEffects && flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
              break;
            default:
              recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              );
          }
          parentFiber = parentFiber.sibling;
        }
      }
      function recursivelyTraverseAtomicPassiveEffects(finishedRoot$jscomp$0, parentFiber) {
        if (parentFiber.subtreeFlags & 10256)
          for (parentFiber = parentFiber.child; null !== parentFiber; ) {
            var finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, flags = finishedWork.flags;
            switch (finishedWork.tag) {
              case 22:
                recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
                flags & 2048 && commitOffscreenPassiveMountEffects(
                  finishedWork.alternate,
                  finishedWork
                );
                break;
              case 24:
                recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
                flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
                break;
              default:
                recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
            }
            parentFiber = parentFiber.sibling;
          }
      }
      var suspenseyCommitFlag = 8192;
      function recursivelyAccumulateSuspenseyCommit(parentFiber) {
        if (parentFiber.subtreeFlags & suspenseyCommitFlag)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            accumulateSuspenseyCommitOnFiber(parentFiber), parentFiber = parentFiber.sibling;
      }
      function accumulateSuspenseyCommitOnFiber(fiber) {
        switch (fiber.tag) {
          case 26:
            recursivelyAccumulateSuspenseyCommit(fiber);
            fiber.flags & suspenseyCommitFlag && null !== fiber.memoizedState && suspendResource(
              currentHoistableRoot,
              fiber.memoizedState,
              fiber.memoizedProps
            );
            break;
          case 5:
            recursivelyAccumulateSuspenseyCommit(fiber);
            break;
          case 3:
          case 4:
            var previousHoistableRoot = currentHoistableRoot;
            currentHoistableRoot = getHoistableRoot(fiber.stateNode.containerInfo);
            recursivelyAccumulateSuspenseyCommit(fiber);
            currentHoistableRoot = previousHoistableRoot;
            break;
          case 22:
            null === fiber.memoizedState && (previousHoistableRoot = fiber.alternate, null !== previousHoistableRoot && null !== previousHoistableRoot.memoizedState ? (previousHoistableRoot = suspenseyCommitFlag, suspenseyCommitFlag = 16777216, recursivelyAccumulateSuspenseyCommit(fiber), suspenseyCommitFlag = previousHoistableRoot) : recursivelyAccumulateSuspenseyCommit(fiber));
            break;
          default:
            recursivelyAccumulateSuspenseyCommit(fiber);
        }
      }
      function detachAlternateSiblings(parentFiber) {
        var previousFiber = parentFiber.alternate;
        if (null !== previousFiber && (parentFiber = previousFiber.child, null !== parentFiber)) {
          previousFiber.child = null;
          do
            previousFiber = parentFiber.sibling, parentFiber.sibling = null, parentFiber = previousFiber;
          while (null !== parentFiber);
        }
      }
      function recursivelyTraversePassiveUnmountEffects(parentFiber) {
        var deletions = parentFiber.deletions;
        if (0 !== (parentFiber.flags & 16)) {
          if (null !== deletions)
            for (var i = 0; i < deletions.length; i++) {
              var childToDelete = deletions[i];
              nextEffect = childToDelete;
              commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
                childToDelete,
                parentFiber
              );
            }
          detachAlternateSiblings(parentFiber);
        }
        if (parentFiber.subtreeFlags & 10256)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitPassiveUnmountOnFiber(parentFiber), parentFiber = parentFiber.sibling;
      }
      function commitPassiveUnmountOnFiber(finishedWork) {
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 15:
            recursivelyTraversePassiveUnmountEffects(finishedWork);
            finishedWork.flags & 2048 && commitHookEffectListUnmount(9, finishedWork, finishedWork.return);
            break;
          case 3:
            recursivelyTraversePassiveUnmountEffects(finishedWork);
            break;
          case 12:
            recursivelyTraversePassiveUnmountEffects(finishedWork);
            break;
          case 22:
            var instance = finishedWork.stateNode;
            null !== finishedWork.memoizedState && instance._visibility & 4 && (null === finishedWork.return || 13 !== finishedWork.return.tag) ? (instance._visibility &= -5, recursivelyTraverseDisconnectPassiveEffects(finishedWork)) : recursivelyTraversePassiveUnmountEffects(finishedWork);
            break;
          default:
            recursivelyTraversePassiveUnmountEffects(finishedWork);
        }
      }
      function recursivelyTraverseDisconnectPassiveEffects(parentFiber) {
        var deletions = parentFiber.deletions;
        if (0 !== (parentFiber.flags & 16)) {
          if (null !== deletions)
            for (var i = 0; i < deletions.length; i++) {
              var childToDelete = deletions[i];
              nextEffect = childToDelete;
              commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
                childToDelete,
                parentFiber
              );
            }
          detachAlternateSiblings(parentFiber);
        }
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          deletions = parentFiber;
          switch (deletions.tag) {
            case 0:
            case 11:
            case 15:
              commitHookEffectListUnmount(8, deletions, deletions.return);
              recursivelyTraverseDisconnectPassiveEffects(deletions);
              break;
            case 22:
              i = deletions.stateNode;
              i._visibility & 4 && (i._visibility &= -5, recursivelyTraverseDisconnectPassiveEffects(deletions));
              break;
            default:
              recursivelyTraverseDisconnectPassiveEffects(deletions);
          }
          parentFiber = parentFiber.sibling;
        }
      }
      function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(deletedSubtreeRoot, nearestMountedAncestor) {
        for (; null !== nextEffect; ) {
          var fiber = nextEffect;
          switch (fiber.tag) {
            case 0:
            case 11:
            case 15:
              commitHookEffectListUnmount(8, fiber, nearestMountedAncestor);
              break;
            case 23:
            case 22:
              if (null !== fiber.memoizedState && null !== fiber.memoizedState.cachePool) {
                var cache = fiber.memoizedState.cachePool.pool;
                null != cache && cache.refCount++;
              }
              break;
            case 24:
              releaseCache(fiber.memoizedState.cache);
          }
          cache = fiber.child;
          if (null !== cache) cache.return = fiber, nextEffect = cache;
          else
            a: for (fiber = deletedSubtreeRoot; null !== nextEffect; ) {
              cache = nextEffect;
              var sibling = cache.sibling, returnFiber = cache.return;
              detachFiberAfterEffects(cache);
              if (cache === fiber) {
                nextEffect = null;
                break a;
              }
              if (null !== sibling) {
                sibling.return = returnFiber;
                nextEffect = sibling;
                break a;
              }
              nextEffect = returnFiber;
            }
        }
      }
      function FiberNode(tag, pendingProps, key, mode2) {
        this.tag = tag;
        this.key = key;
        this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
        this.index = 0;
        this.refCleanup = this.ref = null;
        this.pendingProps = pendingProps;
        this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
        this.mode = mode2;
        this.subtreeFlags = this.flags = 0;
        this.deletions = null;
        this.childLanes = this.lanes = 0;
        this.alternate = null;
      }
      function createFiberImplClass(tag, pendingProps, key, mode2) {
        return new FiberNode(tag, pendingProps, key, mode2);
      }
      function shouldConstruct(Component) {
        Component = Component.prototype;
        return !(!Component || !Component.isReactComponent);
      }
      function createWorkInProgress(current, pendingProps) {
        var workInProgress2 = current.alternate;
        null === workInProgress2 ? (workInProgress2 = createFiberImplClass(
          current.tag,
          pendingProps,
          current.key,
          current.mode
        ), workInProgress2.elementType = current.elementType, workInProgress2.type = current.type, workInProgress2.stateNode = current.stateNode, workInProgress2.alternate = current, current.alternate = workInProgress2) : (workInProgress2.pendingProps = pendingProps, workInProgress2.type = current.type, workInProgress2.flags = 0, workInProgress2.subtreeFlags = 0, workInProgress2.deletions = null);
        workInProgress2.flags = current.flags & 31457280;
        workInProgress2.childLanes = current.childLanes;
        workInProgress2.lanes = current.lanes;
        workInProgress2.child = current.child;
        workInProgress2.memoizedProps = current.memoizedProps;
        workInProgress2.memoizedState = current.memoizedState;
        workInProgress2.updateQueue = current.updateQueue;
        pendingProps = current.dependencies;
        workInProgress2.dependencies = null === pendingProps ? null : { lanes: pendingProps.lanes, firstContext: pendingProps.firstContext };
        workInProgress2.sibling = current.sibling;
        workInProgress2.index = current.index;
        workInProgress2.ref = current.ref;
        workInProgress2.refCleanup = current.refCleanup;
        return workInProgress2;
      }
      function resetWorkInProgress(workInProgress2, renderLanes2) {
        workInProgress2.flags &= 31457282;
        var current = workInProgress2.alternate;
        null === current ? (workInProgress2.childLanes = 0, workInProgress2.lanes = renderLanes2, workInProgress2.child = null, workInProgress2.subtreeFlags = 0, workInProgress2.memoizedProps = null, workInProgress2.memoizedState = null, workInProgress2.updateQueue = null, workInProgress2.dependencies = null, workInProgress2.stateNode = null) : (workInProgress2.childLanes = current.childLanes, workInProgress2.lanes = current.lanes, workInProgress2.child = current.child, workInProgress2.subtreeFlags = 0, workInProgress2.deletions = null, workInProgress2.memoizedProps = current.memoizedProps, workInProgress2.memoizedState = current.memoizedState, workInProgress2.updateQueue = current.updateQueue, workInProgress2.type = current.type, renderLanes2 = current.dependencies, workInProgress2.dependencies = null === renderLanes2 ? null : {
          lanes: renderLanes2.lanes,
          firstContext: renderLanes2.firstContext
        });
        return workInProgress2;
      }
      function createFiberFromTypeAndProps(type2, key, pendingProps, owner, mode2, lanes) {
        var fiberTag = 0;
        owner = type2;
        if ("function" === typeof type2) shouldConstruct(type2) && (fiberTag = 1);
        else if ("string" === typeof type2)
          fiberTag = isHostHoistableType(
            type2,
            pendingProps,
            contextStackCursor.current
          ) ? 26 : "html" === type2 || "head" === type2 || "body" === type2 ? 27 : 5;
        else
          a: switch (type2) {
            case REACT_FRAGMENT_TYPE:
              return createFiberFromFragment(pendingProps.children, mode2, lanes, key);
            case REACT_STRICT_MODE_TYPE:
              fiberTag = 8;
              mode2 |= 24;
              break;
            case REACT_PROFILER_TYPE:
              return type2 = createFiberImplClass(12, pendingProps, key, mode2 | 2), type2.elementType = REACT_PROFILER_TYPE, type2.lanes = lanes, type2;
            case REACT_SUSPENSE_TYPE:
              return type2 = createFiberImplClass(13, pendingProps, key, mode2), type2.elementType = REACT_SUSPENSE_TYPE, type2.lanes = lanes, type2;
            case REACT_SUSPENSE_LIST_TYPE:
              return type2 = createFiberImplClass(19, pendingProps, key, mode2), type2.elementType = REACT_SUSPENSE_LIST_TYPE, type2.lanes = lanes, type2;
            case REACT_OFFSCREEN_TYPE:
              return createFiberFromOffscreen(pendingProps, mode2, lanes, key);
            default:
              if ("object" === typeof type2 && null !== type2)
                switch (type2.$$typeof) {
                  case REACT_PROVIDER_TYPE:
                  case REACT_CONTEXT_TYPE:
                    fiberTag = 10;
                    break a;
                  case REACT_CONSUMER_TYPE:
                    fiberTag = 9;
                    break a;
                  case REACT_FORWARD_REF_TYPE:
                    fiberTag = 11;
                    break a;
                  case REACT_MEMO_TYPE:
                    fiberTag = 14;
                    break a;
                  case REACT_LAZY_TYPE:
                    fiberTag = 16;
                    owner = null;
                    break a;
                }
              fiberTag = 29;
              pendingProps = Error(
                formatProdErrorMessage(130, null === type2 ? "null" : typeof type2, "")
              );
              owner = null;
          }
        key = createFiberImplClass(fiberTag, pendingProps, key, mode2);
        key.elementType = type2;
        key.type = owner;
        key.lanes = lanes;
        return key;
      }
      function createFiberFromFragment(elements, mode2, lanes, key) {
        elements = createFiberImplClass(7, elements, key, mode2);
        elements.lanes = lanes;
        return elements;
      }
      function createFiberFromOffscreen(pendingProps, mode2, lanes, key) {
        pendingProps = createFiberImplClass(22, pendingProps, key, mode2);
        pendingProps.elementType = REACT_OFFSCREEN_TYPE;
        pendingProps.lanes = lanes;
        var primaryChildInstance = {
          _visibility: 1,
          _pendingVisibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null,
          _current: null,
          detach: function() {
            var fiber = primaryChildInstance._current;
            if (null === fiber) throw Error(formatProdErrorMessage(456));
            if (0 === (primaryChildInstance._pendingVisibility & 2)) {
              var root2 = enqueueConcurrentRenderForLane(fiber, 2);
              null !== root2 && (primaryChildInstance._pendingVisibility |= 2, scheduleUpdateOnFiber(root2, fiber, 2));
            }
          },
          attach: function() {
            var fiber = primaryChildInstance._current;
            if (null === fiber) throw Error(formatProdErrorMessage(456));
            if (0 !== (primaryChildInstance._pendingVisibility & 2)) {
              var root2 = enqueueConcurrentRenderForLane(fiber, 2);
              null !== root2 && (primaryChildInstance._pendingVisibility &= -3, scheduleUpdateOnFiber(root2, fiber, 2));
            }
          }
        };
        pendingProps.stateNode = primaryChildInstance;
        return pendingProps;
      }
      function createFiberFromText(content, mode2, lanes) {
        content = createFiberImplClass(6, content, null, mode2);
        content.lanes = lanes;
        return content;
      }
      function createFiberFromPortal(portal, mode2, lanes) {
        mode2 = createFiberImplClass(
          4,
          null !== portal.children ? portal.children : [],
          portal.key,
          mode2
        );
        mode2.lanes = lanes;
        mode2.stateNode = {
          containerInfo: portal.containerInfo,
          pendingChildren: null,
          implementation: portal.implementation
        };
        return mode2;
      }
      function markUpdate(workInProgress2) {
        workInProgress2.flags |= 4;
      }
      function preloadResourceAndSuspendIfNeeded(workInProgress2, resource) {
        if ("stylesheet" !== resource.type || 0 !== (resource.state.loading & 4))
          workInProgress2.flags &= -16777217;
        else if (workInProgress2.flags |= 16777216, !preloadResource(resource)) {
          resource = suspenseHandlerStackCursor.current;
          if (null !== resource && ((workInProgressRootRenderLanes & 4194176) === workInProgressRootRenderLanes ? null !== shellBoundary : (workInProgressRootRenderLanes & 62914560) !== workInProgressRootRenderLanes && 0 === (workInProgressRootRenderLanes & 536870912) || resource !== shellBoundary))
            throw suspendedThenable = noopSuspenseyCommitThenable, SuspenseyCommitException;
          workInProgress2.flags |= 8192;
        }
      }
      function scheduleRetryEffect(workInProgress2, retryQueue) {
        null !== retryQueue && (workInProgress2.flags |= 4);
        workInProgress2.flags & 16384 && (retryQueue = 22 !== workInProgress2.tag ? claimNextRetryLane() : 536870912, workInProgress2.lanes |= retryQueue, workInProgressSuspendedRetryLanes |= retryQueue);
      }
      function cutOffTailIfNeeded(renderState, hasRenderedATailFallback) {
        if (!isHydrating)
          switch (renderState.tailMode) {
            case "hidden":
              hasRenderedATailFallback = renderState.tail;
              for (var lastTailNode = null; null !== hasRenderedATailFallback; )
                null !== hasRenderedATailFallback.alternate && (lastTailNode = hasRenderedATailFallback), hasRenderedATailFallback = hasRenderedATailFallback.sibling;
              null === lastTailNode ? renderState.tail = null : lastTailNode.sibling = null;
              break;
            case "collapsed":
              lastTailNode = renderState.tail;
              for (var lastTailNode$131 = null; null !== lastTailNode; )
                null !== lastTailNode.alternate && (lastTailNode$131 = lastTailNode), lastTailNode = lastTailNode.sibling;
              null === lastTailNode$131 ? hasRenderedATailFallback || null === renderState.tail ? renderState.tail = null : renderState.tail.sibling = null : lastTailNode$131.sibling = null;
          }
      }
      function bubbleProperties(completedWork) {
        var didBailout = null !== completedWork.alternate && completedWork.alternate.child === completedWork.child, newChildLanes = 0, subtreeFlags = 0;
        if (didBailout)
          for (var child$132 = completedWork.child; null !== child$132; )
            newChildLanes |= child$132.lanes | child$132.childLanes, subtreeFlags |= child$132.subtreeFlags & 31457280, subtreeFlags |= child$132.flags & 31457280, child$132.return = completedWork, child$132 = child$132.sibling;
        else
          for (child$132 = completedWork.child; null !== child$132; )
            newChildLanes |= child$132.lanes | child$132.childLanes, subtreeFlags |= child$132.subtreeFlags, subtreeFlags |= child$132.flags, child$132.return = completedWork, child$132 = child$132.sibling;
        completedWork.subtreeFlags |= subtreeFlags;
        completedWork.childLanes = newChildLanes;
        return didBailout;
      }
      function completeWork(current, workInProgress2, renderLanes2) {
        var newProps = workInProgress2.pendingProps;
        popTreeContext(workInProgress2);
        switch (workInProgress2.tag) {
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return bubbleProperties(workInProgress2), null;
          case 1:
            return bubbleProperties(workInProgress2), null;
          case 3:
            renderLanes2 = workInProgress2.stateNode;
            newProps = null;
            null !== current && (newProps = current.memoizedState.cache);
            workInProgress2.memoizedState.cache !== newProps && (workInProgress2.flags |= 2048);
            popProvider(CacheContext);
            popHostContainer();
            renderLanes2.pendingContext && (renderLanes2.context = renderLanes2.pendingContext, renderLanes2.pendingContext = null);
            if (null === current || null === current.child)
              popHydrationState(workInProgress2) ? markUpdate(workInProgress2) : null === current || current.memoizedState.isDehydrated && 0 === (workInProgress2.flags & 256) || (workInProgress2.flags |= 1024, null !== hydrationErrors && (queueRecoverableErrors(hydrationErrors), hydrationErrors = null));
            bubbleProperties(workInProgress2);
            return null;
          case 26:
            return renderLanes2 = workInProgress2.memoizedState, null === current ? (markUpdate(workInProgress2), null !== renderLanes2 ? (bubbleProperties(workInProgress2), preloadResourceAndSuspendIfNeeded(workInProgress2, renderLanes2)) : (bubbleProperties(workInProgress2), workInProgress2.flags &= -16777217)) : renderLanes2 ? renderLanes2 !== current.memoizedState ? (markUpdate(workInProgress2), bubbleProperties(workInProgress2), preloadResourceAndSuspendIfNeeded(workInProgress2, renderLanes2)) : (bubbleProperties(workInProgress2), workInProgress2.flags &= -16777217) : (current.memoizedProps !== newProps && markUpdate(workInProgress2), bubbleProperties(workInProgress2), workInProgress2.flags &= -16777217), null;
          case 27:
            popHostContext(workInProgress2);
            renderLanes2 = rootInstanceStackCursor.current;
            var type2 = workInProgress2.type;
            if (null !== current && null != workInProgress2.stateNode)
              current.memoizedProps !== newProps && markUpdate(workInProgress2);
            else {
              if (!newProps) {
                if (null === workInProgress2.stateNode)
                  throw Error(formatProdErrorMessage(166));
                bubbleProperties(workInProgress2);
                return null;
              }
              current = contextStackCursor.current;
              popHydrationState(workInProgress2) ? prepareToHydrateHostInstance(workInProgress2, current) : (current = resolveSingletonInstance(type2, newProps, renderLanes2), workInProgress2.stateNode = current, markUpdate(workInProgress2));
            }
            bubbleProperties(workInProgress2);
            return null;
          case 5:
            popHostContext(workInProgress2);
            renderLanes2 = workInProgress2.type;
            if (null !== current && null != workInProgress2.stateNode)
              current.memoizedProps !== newProps && markUpdate(workInProgress2);
            else {
              if (!newProps) {
                if (null === workInProgress2.stateNode)
                  throw Error(formatProdErrorMessage(166));
                bubbleProperties(workInProgress2);
                return null;
              }
              current = contextStackCursor.current;
              if (popHydrationState(workInProgress2))
                prepareToHydrateHostInstance(workInProgress2, current);
              else {
                type2 = getOwnerDocumentFromRootContainer(
                  rootInstanceStackCursor.current
                );
                switch (current) {
                  case 1:
                    current = type2.createElementNS(
                      "http://www.w3.org/2000/svg",
                      renderLanes2
                    );
                    break;
                  case 2:
                    current = type2.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      renderLanes2
                    );
                    break;
                  default:
                    switch (renderLanes2) {
                      case "svg":
                        current = type2.createElementNS(
                          "http://www.w3.org/2000/svg",
                          renderLanes2
                        );
                        break;
                      case "math":
                        current = type2.createElementNS(
                          "http://www.w3.org/1998/Math/MathML",
                          renderLanes2
                        );
                        break;
                      case "script":
                        current = type2.createElement("div");
                        current.innerHTML = "<script><\/script>";
                        current = current.removeChild(current.firstChild);
                        break;
                      case "select":
                        current = "string" === typeof newProps.is ? type2.createElement("select", { is: newProps.is }) : type2.createElement("select");
                        newProps.multiple ? current.multiple = true : newProps.size && (current.size = newProps.size);
                        break;
                      default:
                        current = "string" === typeof newProps.is ? type2.createElement(renderLanes2, { is: newProps.is }) : type2.createElement(renderLanes2);
                    }
                }
                current[internalInstanceKey] = workInProgress2;
                current[internalPropsKey] = newProps;
                a: for (type2 = workInProgress2.child; null !== type2; ) {
                  if (5 === type2.tag || 6 === type2.tag)
                    current.appendChild(type2.stateNode);
                  else if (4 !== type2.tag && 27 !== type2.tag && null !== type2.child) {
                    type2.child.return = type2;
                    type2 = type2.child;
                    continue;
                  }
                  if (type2 === workInProgress2) break a;
                  for (; null === type2.sibling; ) {
                    if (null === type2.return || type2.return === workInProgress2)
                      break a;
                    type2 = type2.return;
                  }
                  type2.sibling.return = type2.return;
                  type2 = type2.sibling;
                }
                workInProgress2.stateNode = current;
                a: switch (setInitialProperties(current, renderLanes2, newProps), renderLanes2) {
                  case "button":
                  case "input":
                  case "select":
                  case "textarea":
                    current = !!newProps.autoFocus;
                    break a;
                  case "img":
                    current = true;
                    break a;
                  default:
                    current = false;
                }
                current && markUpdate(workInProgress2);
              }
            }
            bubbleProperties(workInProgress2);
            workInProgress2.flags &= -16777217;
            return null;
          case 6:
            if (current && null != workInProgress2.stateNode)
              current.memoizedProps !== newProps && markUpdate(workInProgress2);
            else {
              if ("string" !== typeof newProps && null === workInProgress2.stateNode)
                throw Error(formatProdErrorMessage(166));
              current = rootInstanceStackCursor.current;
              if (popHydrationState(workInProgress2)) {
                current = workInProgress2.stateNode;
                renderLanes2 = workInProgress2.memoizedProps;
                newProps = null;
                type2 = hydrationParentFiber;
                if (null !== type2)
                  switch (type2.tag) {
                    case 27:
                    case 5:
                      newProps = type2.memoizedProps;
                  }
                current[internalInstanceKey] = workInProgress2;
                current = current.nodeValue === renderLanes2 || null !== newProps && true === newProps.suppressHydrationWarning || checkForUnmatchedText(current.nodeValue, renderLanes2) ? true : false;
                current || throwOnHydrationMismatch(workInProgress2);
              } else
                current = getOwnerDocumentFromRootContainer(current).createTextNode(
                  newProps
                ), current[internalInstanceKey] = workInProgress2, workInProgress2.stateNode = current;
            }
            bubbleProperties(workInProgress2);
            return null;
          case 13:
            newProps = workInProgress2.memoizedState;
            if (null === current || null !== current.memoizedState && null !== current.memoizedState.dehydrated) {
              type2 = popHydrationState(workInProgress2);
              if (null !== newProps && null !== newProps.dehydrated) {
                if (null === current) {
                  if (!type2) throw Error(formatProdErrorMessage(318));
                  type2 = workInProgress2.memoizedState;
                  type2 = null !== type2 ? type2.dehydrated : null;
                  if (!type2) throw Error(formatProdErrorMessage(317));
                  type2[internalInstanceKey] = workInProgress2;
                } else
                  resetHydrationState(), 0 === (workInProgress2.flags & 128) && (workInProgress2.memoizedState = null), workInProgress2.flags |= 4;
                bubbleProperties(workInProgress2);
                type2 = false;
              } else
                null !== hydrationErrors && (queueRecoverableErrors(hydrationErrors), hydrationErrors = null), type2 = true;
              if (!type2) {
                if (workInProgress2.flags & 256)
                  return popSuspenseHandler(workInProgress2), workInProgress2;
                popSuspenseHandler(workInProgress2);
                return null;
              }
            }
            popSuspenseHandler(workInProgress2);
            if (0 !== (workInProgress2.flags & 128))
              return workInProgress2.lanes = renderLanes2, workInProgress2;
            renderLanes2 = null !== newProps;
            current = null !== current && null !== current.memoizedState;
            if (renderLanes2) {
              newProps = workInProgress2.child;
              type2 = null;
              null !== newProps.alternate && null !== newProps.alternate.memoizedState && null !== newProps.alternate.memoizedState.cachePool && (type2 = newProps.alternate.memoizedState.cachePool.pool);
              var cache$144 = null;
              null !== newProps.memoizedState && null !== newProps.memoizedState.cachePool && (cache$144 = newProps.memoizedState.cachePool.pool);
              cache$144 !== type2 && (newProps.flags |= 2048);
            }
            renderLanes2 !== current && renderLanes2 && (workInProgress2.child.flags |= 8192);
            scheduleRetryEffect(workInProgress2, workInProgress2.updateQueue);
            bubbleProperties(workInProgress2);
            return null;
          case 4:
            return popHostContainer(), null === current && listenToAllSupportedEvents(workInProgress2.stateNode.containerInfo), bubbleProperties(workInProgress2), null;
          case 10:
            return popProvider(workInProgress2.type), bubbleProperties(workInProgress2), null;
          case 19:
            pop(suspenseStackCursor);
            type2 = workInProgress2.memoizedState;
            if (null === type2) return bubbleProperties(workInProgress2), null;
            newProps = 0 !== (workInProgress2.flags & 128);
            cache$144 = type2.rendering;
            if (null === cache$144)
              if (newProps) cutOffTailIfNeeded(type2, false);
              else {
                if (0 !== workInProgressRootExitStatus || null !== current && 0 !== (current.flags & 128))
                  for (current = workInProgress2.child; null !== current; ) {
                    cache$144 = findFirstSuspended(current);
                    if (null !== cache$144) {
                      workInProgress2.flags |= 128;
                      cutOffTailIfNeeded(type2, false);
                      current = cache$144.updateQueue;
                      workInProgress2.updateQueue = current;
                      scheduleRetryEffect(workInProgress2, current);
                      workInProgress2.subtreeFlags = 0;
                      current = renderLanes2;
                      for (renderLanes2 = workInProgress2.child; null !== renderLanes2; )
                        resetWorkInProgress(renderLanes2, current), renderLanes2 = renderLanes2.sibling;
                      push(
                        suspenseStackCursor,
                        suspenseStackCursor.current & 1 | 2
                      );
                      return workInProgress2.child;
                    }
                    current = current.sibling;
                  }
                null !== type2.tail && now() > workInProgressRootRenderTargetTime && (workInProgress2.flags |= 128, newProps = true, cutOffTailIfNeeded(type2, false), workInProgress2.lanes = 4194304);
              }
            else {
              if (!newProps)
                if (current = findFirstSuspended(cache$144), null !== current) {
                  if (workInProgress2.flags |= 128, newProps = true, current = current.updateQueue, workInProgress2.updateQueue = current, scheduleRetryEffect(workInProgress2, current), cutOffTailIfNeeded(type2, true), null === type2.tail && "hidden" === type2.tailMode && !cache$144.alternate && !isHydrating)
                    return bubbleProperties(workInProgress2), null;
                } else
                  2 * now() - type2.renderingStartTime > workInProgressRootRenderTargetTime && 536870912 !== renderLanes2 && (workInProgress2.flags |= 128, newProps = true, cutOffTailIfNeeded(type2, false), workInProgress2.lanes = 4194304);
              type2.isBackwards ? (cache$144.sibling = workInProgress2.child, workInProgress2.child = cache$144) : (current = type2.last, null !== current ? current.sibling = cache$144 : workInProgress2.child = cache$144, type2.last = cache$144);
            }
            if (null !== type2.tail)
              return workInProgress2 = type2.tail, type2.rendering = workInProgress2, type2.tail = workInProgress2.sibling, type2.renderingStartTime = now(), workInProgress2.sibling = null, current = suspenseStackCursor.current, push(suspenseStackCursor, newProps ? current & 1 | 2 : current & 1), workInProgress2;
            bubbleProperties(workInProgress2);
            return null;
          case 22:
          case 23:
            return popSuspenseHandler(workInProgress2), popHiddenContext(), newProps = null !== workInProgress2.memoizedState, null !== current ? null !== current.memoizedState !== newProps && (workInProgress2.flags |= 8192) : newProps && (workInProgress2.flags |= 8192), newProps ? 0 !== (renderLanes2 & 536870912) && 0 === (workInProgress2.flags & 128) && (bubbleProperties(workInProgress2), workInProgress2.subtreeFlags & 6 && (workInProgress2.flags |= 8192)) : bubbleProperties(workInProgress2), renderLanes2 = workInProgress2.updateQueue, null !== renderLanes2 && scheduleRetryEffect(workInProgress2, renderLanes2.retryQueue), renderLanes2 = null, null !== current && null !== current.memoizedState && null !== current.memoizedState.cachePool && (renderLanes2 = current.memoizedState.cachePool.pool), newProps = null, null !== workInProgress2.memoizedState && null !== workInProgress2.memoizedState.cachePool && (newProps = workInProgress2.memoizedState.cachePool.pool), newProps !== renderLanes2 && (workInProgress2.flags |= 2048), null !== current && pop(resumedCache), null;
          case 24:
            return renderLanes2 = null, null !== current && (renderLanes2 = current.memoizedState.cache), workInProgress2.memoizedState.cache !== renderLanes2 && (workInProgress2.flags |= 2048), popProvider(CacheContext), bubbleProperties(workInProgress2), null;
          case 25:
            return null;
        }
        throw Error(formatProdErrorMessage(156, workInProgress2.tag));
      }
      function unwindWork(current, workInProgress2) {
        popTreeContext(workInProgress2);
        switch (workInProgress2.tag) {
          case 1:
            return current = workInProgress2.flags, current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 3:
            return popProvider(CacheContext), popHostContainer(), current = workInProgress2.flags, 0 !== (current & 65536) && 0 === (current & 128) ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 26:
          case 27:
          case 5:
            return popHostContext(workInProgress2), null;
          case 13:
            popSuspenseHandler(workInProgress2);
            current = workInProgress2.memoizedState;
            if (null !== current && null !== current.dehydrated) {
              if (null === workInProgress2.alternate)
                throw Error(formatProdErrorMessage(340));
              resetHydrationState();
            }
            current = workInProgress2.flags;
            return current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 19:
            return pop(suspenseStackCursor), null;
          case 4:
            return popHostContainer(), null;
          case 10:
            return popProvider(workInProgress2.type), null;
          case 22:
          case 23:
            return popSuspenseHandler(workInProgress2), popHiddenContext(), null !== current && pop(resumedCache), current = workInProgress2.flags, current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 24:
            return popProvider(CacheContext), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function unwindInterruptedWork(current, interruptedWork) {
        popTreeContext(interruptedWork);
        switch (interruptedWork.tag) {
          case 3:
            popProvider(CacheContext);
            popHostContainer();
            break;
          case 26:
          case 27:
          case 5:
            popHostContext(interruptedWork);
            break;
          case 4:
            popHostContainer();
            break;
          case 13:
            popSuspenseHandler(interruptedWork);
            break;
          case 19:
            pop(suspenseStackCursor);
            break;
          case 10:
            popProvider(interruptedWork.type);
            break;
          case 22:
          case 23:
            popSuspenseHandler(interruptedWork);
            popHiddenContext();
            null !== current && pop(resumedCache);
            break;
          case 24:
            popProvider(CacheContext);
        }
      }
      var DefaultAsyncDispatcher = {
        getCacheForType: function(resourceType) {
          var cache = readContext(CacheContext), cacheForType = cache.data.get(resourceType);
          void 0 === cacheForType && (cacheForType = resourceType(), cache.data.set(resourceType, cacheForType));
          return cacheForType;
        }
      };
      var PossiblyWeakMap = "function" === typeof WeakMap ? WeakMap : Map;
      var executionContext = 0;
      var workInProgressRoot = null;
      var workInProgress = null;
      var workInProgressRootRenderLanes = 0;
      var workInProgressSuspendedReason = 0;
      var workInProgressThrownValue = null;
      var workInProgressRootDidSkipSuspendedSiblings = false;
      var workInProgressRootIsPrerendering = false;
      var workInProgressRootDidAttachPingListener = false;
      var entangledRenderLanes = 0;
      var workInProgressRootExitStatus = 0;
      var workInProgressRootSkippedLanes = 0;
      var workInProgressRootInterleavedUpdatedLanes = 0;
      var workInProgressRootPingedLanes = 0;
      var workInProgressDeferredLane = 0;
      var workInProgressSuspendedRetryLanes = 0;
      var workInProgressRootConcurrentErrors = null;
      var workInProgressRootRecoverableErrors = null;
      var workInProgressRootDidIncludeRecursiveRenderUpdate = false;
      var globalMostRecentFallbackTime = 0;
      var workInProgressRootRenderTargetTime = Infinity;
      var workInProgressTransitions = null;
      var legacyErrorBoundariesThatAlreadyFailed = null;
      var rootDoesHavePassiveEffects = false;
      var rootWithPendingPassiveEffects = null;
      var pendingPassiveEffectsLanes = 0;
      var pendingPassiveEffectsRemainingLanes = 0;
      var pendingPassiveTransitions = null;
      var nestedUpdateCount = 0;
      var rootWithNestedUpdates = null;
      function requestUpdateLane() {
        if (0 !== (executionContext & 2) && 0 !== workInProgressRootRenderLanes)
          return workInProgressRootRenderLanes & -workInProgressRootRenderLanes;
        if (null !== ReactSharedInternals.T) {
          var actionScopeLane = currentEntangledLane;
          return 0 !== actionScopeLane ? actionScopeLane : requestTransitionLane();
        }
        return resolveUpdatePriority();
      }
      function requestDeferredLane() {
        0 === workInProgressDeferredLane && (workInProgressDeferredLane = 0 === (workInProgressRootRenderLanes & 536870912) || isHydrating ? claimNextTransitionLane() : 536870912);
        var suspenseHandler = suspenseHandlerStackCursor.current;
        null !== suspenseHandler && (suspenseHandler.flags |= 32);
        return workInProgressDeferredLane;
      }
      function scheduleUpdateOnFiber(root2, fiber, lane) {
        if (root2 === workInProgressRoot && 2 === workInProgressSuspendedReason || null !== root2.cancelPendingCommit)
          prepareFreshStack(root2, 0), markRootSuspended(
            root2,
            workInProgressRootRenderLanes,
            workInProgressDeferredLane,
            false
          );
        markRootUpdated$1(root2, lane);
        if (0 === (executionContext & 2) || root2 !== workInProgressRoot)
          root2 === workInProgressRoot && (0 === (executionContext & 2) && (workInProgressRootInterleavedUpdatedLanes |= lane), 4 === workInProgressRootExitStatus && markRootSuspended(
            root2,
            workInProgressRootRenderLanes,
            workInProgressDeferredLane,
            false
          )), ensureRootIsScheduled(root2);
      }
      function performWorkOnRoot(root$jscomp$0, lanes, forceSync) {
        if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(327));
        var shouldTimeSlice = !forceSync && 0 === (lanes & 60) && 0 === (lanes & root$jscomp$0.expiredLanes) || checkIfRootIsPrerendering(root$jscomp$0, lanes), exitStatus = shouldTimeSlice ? renderRootConcurrent(root$jscomp$0, lanes) : renderRootSync(root$jscomp$0, lanes, true), renderWasConcurrent = shouldTimeSlice;
        do {
          if (0 === exitStatus) {
            workInProgressRootIsPrerendering && !shouldTimeSlice && markRootSuspended(root$jscomp$0, lanes, 0, false);
            break;
          } else if (6 === exitStatus)
            markRootSuspended(
              root$jscomp$0,
              lanes,
              0,
              !workInProgressRootDidSkipSuspendedSiblings
            );
          else {
            forceSync = root$jscomp$0.current.alternate;
            if (renderWasConcurrent && !isRenderConsistentWithExternalStores(forceSync)) {
              exitStatus = renderRootSync(root$jscomp$0, lanes, false);
              renderWasConcurrent = false;
              continue;
            }
            if (2 === exitStatus) {
              renderWasConcurrent = lanes;
              if (root$jscomp$0.errorRecoveryDisabledLanes & renderWasConcurrent)
                var JSCompiler_inline_result = 0;
              else
                JSCompiler_inline_result = root$jscomp$0.pendingLanes & -536870913, JSCompiler_inline_result = 0 !== JSCompiler_inline_result ? JSCompiler_inline_result : JSCompiler_inline_result & 536870912 ? 536870912 : 0;
              if (0 !== JSCompiler_inline_result) {
                lanes = JSCompiler_inline_result;
                a: {
                  var root2 = root$jscomp$0;
                  exitStatus = workInProgressRootConcurrentErrors;
                  var wasRootDehydrated = root2.current.memoizedState.isDehydrated;
                  wasRootDehydrated && (prepareFreshStack(root2, JSCompiler_inline_result).flags |= 256);
                  JSCompiler_inline_result = renderRootSync(
                    root2,
                    JSCompiler_inline_result,
                    false
                  );
                  if (2 !== JSCompiler_inline_result) {
                    if (workInProgressRootDidAttachPingListener && !wasRootDehydrated) {
                      root2.errorRecoveryDisabledLanes |= renderWasConcurrent;
                      workInProgressRootInterleavedUpdatedLanes |= renderWasConcurrent;
                      exitStatus = 4;
                      break a;
                    }
                    renderWasConcurrent = workInProgressRootRecoverableErrors;
                    workInProgressRootRecoverableErrors = exitStatus;
                    null !== renderWasConcurrent && queueRecoverableErrors(renderWasConcurrent);
                  }
                  exitStatus = JSCompiler_inline_result;
                }
                renderWasConcurrent = false;
                if (2 !== exitStatus) continue;
              }
            }
            if (1 === exitStatus) {
              prepareFreshStack(root$jscomp$0, 0);
              markRootSuspended(root$jscomp$0, lanes, 0, true);
              break;
            }
            a: {
              shouldTimeSlice = root$jscomp$0;
              switch (exitStatus) {
                case 0:
                case 1:
                  throw Error(formatProdErrorMessage(345));
                case 4:
                  if ((lanes & 4194176) === lanes) {
                    markRootSuspended(
                      shouldTimeSlice,
                      lanes,
                      workInProgressDeferredLane,
                      !workInProgressRootDidSkipSuspendedSiblings
                    );
                    break a;
                  }
                  break;
                case 2:
                  workInProgressRootRecoverableErrors = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(formatProdErrorMessage(329));
              }
              shouldTimeSlice.finishedWork = forceSync;
              shouldTimeSlice.finishedLanes = lanes;
              if ((lanes & 62914560) === lanes && (renderWasConcurrent = globalMostRecentFallbackTime + 300 - now(), 10 < renderWasConcurrent)) {
                markRootSuspended(
                  shouldTimeSlice,
                  lanes,
                  workInProgressDeferredLane,
                  !workInProgressRootDidSkipSuspendedSiblings
                );
                if (0 !== getNextLanes(shouldTimeSlice, 0)) break a;
                shouldTimeSlice.timeoutHandle = scheduleTimeout(
                  commitRootWhenReady.bind(
                    null,
                    shouldTimeSlice,
                    forceSync,
                    workInProgressRootRecoverableErrors,
                    workInProgressTransitions,
                    workInProgressRootDidIncludeRecursiveRenderUpdate,
                    lanes,
                    workInProgressDeferredLane,
                    workInProgressRootInterleavedUpdatedLanes,
                    workInProgressSuspendedRetryLanes,
                    workInProgressRootDidSkipSuspendedSiblings,
                    2,
                    -0,
                    0
                  ),
                  renderWasConcurrent
                );
                break a;
              }
              commitRootWhenReady(
                shouldTimeSlice,
                forceSync,
                workInProgressRootRecoverableErrors,
                workInProgressTransitions,
                workInProgressRootDidIncludeRecursiveRenderUpdate,
                lanes,
                workInProgressDeferredLane,
                workInProgressRootInterleavedUpdatedLanes,
                workInProgressSuspendedRetryLanes,
                workInProgressRootDidSkipSuspendedSiblings,
                0,
                -0,
                0
              );
            }
          }
          break;
        } while (1);
        ensureRootIsScheduled(root$jscomp$0);
      }
      function queueRecoverableErrors(errors) {
        null === workInProgressRootRecoverableErrors ? workInProgressRootRecoverableErrors = errors : workInProgressRootRecoverableErrors.push.apply(
          workInProgressRootRecoverableErrors,
          errors
        );
      }
      function commitRootWhenReady(root2, finishedWork, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, lanes, spawnedLane, updatedLanes, suspendedRetryLanes, didSkipSuspendedSiblings, suspendedCommitReason, completedRenderStartTime, completedRenderEndTime) {
        var subtreeFlags = finishedWork.subtreeFlags;
        if (subtreeFlags & 8192 || 16785408 === (subtreeFlags & 16785408)) {
          if (suspendedState = { stylesheets: null, count: 0, unsuspend: noop }, accumulateSuspenseyCommitOnFiber(finishedWork), finishedWork = waitForCommitToBeReady(), null !== finishedWork) {
            root2.cancelPendingCommit = finishedWork(
              commitRoot.bind(
                null,
                root2,
                recoverableErrors,
                transitions,
                didIncludeRenderPhaseUpdate,
                spawnedLane,
                updatedLanes,
                suspendedRetryLanes,
                1,
                completedRenderStartTime,
                completedRenderEndTime
              )
            );
            markRootSuspended(root2, lanes, spawnedLane, !didSkipSuspendedSiblings);
            return;
          }
        }
        commitRoot(
          root2,
          recoverableErrors,
          transitions,
          didIncludeRenderPhaseUpdate,
          spawnedLane,
          updatedLanes,
          suspendedRetryLanes,
          suspendedCommitReason,
          completedRenderStartTime,
          completedRenderEndTime
        );
      }
      function isRenderConsistentWithExternalStores(finishedWork) {
        for (var node = finishedWork; ; ) {
          var tag = node.tag;
          if ((0 === tag || 11 === tag || 15 === tag) && node.flags & 16384 && (tag = node.updateQueue, null !== tag && (tag = tag.stores, null !== tag)))
            for (var i = 0; i < tag.length; i++) {
              var check = tag[i], getSnapshot = check.getSnapshot;
              check = check.value;
              try {
                if (!objectIs(getSnapshot(), check)) return false;
              } catch (error) {
                return false;
              }
            }
          tag = node.child;
          if (node.subtreeFlags & 16384 && null !== tag)
            tag.return = node, node = tag;
          else {
            if (node === finishedWork) break;
            for (; null === node.sibling; ) {
              if (null === node.return || node.return === finishedWork) return true;
              node = node.return;
            }
            node.sibling.return = node.return;
            node = node.sibling;
          }
        }
        return true;
      }
      function markRootSuspended(root2, suspendedLanes, spawnedLane, didAttemptEntireTree) {
        suspendedLanes &= ~workInProgressRootPingedLanes;
        suspendedLanes &= ~workInProgressRootInterleavedUpdatedLanes;
        root2.suspendedLanes |= suspendedLanes;
        root2.pingedLanes &= ~suspendedLanes;
        didAttemptEntireTree && (root2.warmLanes |= suspendedLanes);
        didAttemptEntireTree = root2.expirationTimes;
        for (var lanes = suspendedLanes; 0 < lanes; ) {
          var index$6 = 31 - clz32(lanes), lane = 1 << index$6;
          didAttemptEntireTree[index$6] = -1;
          lanes &= ~lane;
        }
        0 !== spawnedLane && markSpawnedDeferredLane(root2, spawnedLane, suspendedLanes);
      }
      function flushSyncWork$1() {
        return 0 === (executionContext & 6) ? (flushSyncWorkAcrossRoots_impl(0, false), false) : true;
      }
      function resetWorkInProgressStack() {
        if (null !== workInProgress) {
          if (0 === workInProgressSuspendedReason)
            var interruptedWork = workInProgress.return;
          else
            interruptedWork = workInProgress, lastContextDependency = currentlyRenderingFiber = null, resetHooksOnUnwind(interruptedWork), thenableState$1 = null, thenableIndexCounter$1 = 0, interruptedWork = workInProgress;
          for (; null !== interruptedWork; )
            unwindInterruptedWork(interruptedWork.alternate, interruptedWork), interruptedWork = interruptedWork.return;
          workInProgress = null;
        }
      }
      function prepareFreshStack(root2, lanes) {
        root2.finishedWork = null;
        root2.finishedLanes = 0;
        var timeoutHandle = root2.timeoutHandle;
        -1 !== timeoutHandle && (root2.timeoutHandle = -1, cancelTimeout(timeoutHandle));
        timeoutHandle = root2.cancelPendingCommit;
        null !== timeoutHandle && (root2.cancelPendingCommit = null, timeoutHandle());
        resetWorkInProgressStack();
        workInProgressRoot = root2;
        workInProgress = timeoutHandle = createWorkInProgress(root2.current, null);
        workInProgressRootRenderLanes = lanes;
        workInProgressSuspendedReason = 0;
        workInProgressThrownValue = null;
        workInProgressRootDidSkipSuspendedSiblings = false;
        workInProgressRootIsPrerendering = checkIfRootIsPrerendering(root2, lanes);
        workInProgressRootDidAttachPingListener = false;
        workInProgressSuspendedRetryLanes = workInProgressDeferredLane = workInProgressRootPingedLanes = workInProgressRootInterleavedUpdatedLanes = workInProgressRootSkippedLanes = workInProgressRootExitStatus = 0;
        workInProgressRootRecoverableErrors = workInProgressRootConcurrentErrors = null;
        workInProgressRootDidIncludeRecursiveRenderUpdate = false;
        0 !== (lanes & 8) && (lanes |= lanes & 32);
        var allEntangledLanes = root2.entangledLanes;
        if (0 !== allEntangledLanes)
          for (root2 = root2.entanglements, allEntangledLanes &= lanes; 0 < allEntangledLanes; ) {
            var index$4 = 31 - clz32(allEntangledLanes), lane = 1 << index$4;
            lanes |= root2[index$4];
            allEntangledLanes &= ~lane;
          }
        entangledRenderLanes = lanes;
        finishQueueingConcurrentUpdates();
        return timeoutHandle;
      }
      function handleThrow(root2, thrownValue) {
        currentlyRenderingFiber$1 = null;
        ReactSharedInternals.H = ContextOnlyDispatcher;
        thrownValue === SuspenseException ? (thrownValue = getSuspendedThenable(), workInProgressSuspendedReason = 3) : thrownValue === SuspenseyCommitException ? (thrownValue = getSuspendedThenable(), workInProgressSuspendedReason = 4) : workInProgressSuspendedReason = thrownValue === SelectiveHydrationException ? 8 : null !== thrownValue && "object" === typeof thrownValue && "function" === typeof thrownValue.then ? 6 : 1;
        workInProgressThrownValue = thrownValue;
        null === workInProgress && (workInProgressRootExitStatus = 1, logUncaughtError(
          root2,
          createCapturedValueAtFiber(thrownValue, root2.current)
        ));
      }
      function pushDispatcher() {
        var prevDispatcher = ReactSharedInternals.H;
        ReactSharedInternals.H = ContextOnlyDispatcher;
        return null === prevDispatcher ? ContextOnlyDispatcher : prevDispatcher;
      }
      function pushAsyncDispatcher() {
        var prevAsyncDispatcher = ReactSharedInternals.A;
        ReactSharedInternals.A = DefaultAsyncDispatcher;
        return prevAsyncDispatcher;
      }
      function renderDidSuspendDelayIfPossible() {
        workInProgressRootExitStatus = 4;
        workInProgressRootDidSkipSuspendedSiblings || (workInProgressRootRenderLanes & 4194176) !== workInProgressRootRenderLanes && null !== suspenseHandlerStackCursor.current || (workInProgressRootIsPrerendering = true);
        0 === (workInProgressRootSkippedLanes & 134217727) && 0 === (workInProgressRootInterleavedUpdatedLanes & 134217727) || null === workInProgressRoot || markRootSuspended(
          workInProgressRoot,
          workInProgressRootRenderLanes,
          workInProgressDeferredLane,
          false
        );
      }
      function renderRootSync(root2, lanes, shouldYieldForPrerendering) {
        var prevExecutionContext = executionContext;
        executionContext |= 2;
        var prevDispatcher = pushDispatcher(), prevAsyncDispatcher = pushAsyncDispatcher();
        if (workInProgressRoot !== root2 || workInProgressRootRenderLanes !== lanes)
          workInProgressTransitions = null, prepareFreshStack(root2, lanes);
        lanes = false;
        var exitStatus = workInProgressRootExitStatus;
        a: do
          try {
            if (0 !== workInProgressSuspendedReason && null !== workInProgress) {
              var unitOfWork = workInProgress, thrownValue = workInProgressThrownValue;
              switch (workInProgressSuspendedReason) {
                case 8:
                  resetWorkInProgressStack();
                  exitStatus = 6;
                  break a;
                case 3:
                case 2:
                case 6:
                  null === suspenseHandlerStackCursor.current && (lanes = true);
                  var reason = workInProgressSuspendedReason;
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, reason);
                  if (shouldYieldForPrerendering && workInProgressRootIsPrerendering) {
                    exitStatus = 0;
                    break a;
                  }
                  break;
                default:
                  reason = workInProgressSuspendedReason, workInProgressSuspendedReason = 0, workInProgressThrownValue = null, throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, reason);
              }
            }
            workLoopSync();
            exitStatus = workInProgressRootExitStatus;
            break;
          } catch (thrownValue$164) {
            handleThrow(root2, thrownValue$164);
          }
        while (1);
        lanes && root2.shellSuspendCounter++;
        lastContextDependency = currentlyRenderingFiber = null;
        executionContext = prevExecutionContext;
        ReactSharedInternals.H = prevDispatcher;
        ReactSharedInternals.A = prevAsyncDispatcher;
        null === workInProgress && (workInProgressRoot = null, workInProgressRootRenderLanes = 0, finishQueueingConcurrentUpdates());
        return exitStatus;
      }
      function workLoopSync() {
        for (; null !== workInProgress; ) performUnitOfWork(workInProgress);
      }
      function renderRootConcurrent(root2, lanes) {
        var prevExecutionContext = executionContext;
        executionContext |= 2;
        var prevDispatcher = pushDispatcher(), prevAsyncDispatcher = pushAsyncDispatcher();
        workInProgressRoot !== root2 || workInProgressRootRenderLanes !== lanes ? (workInProgressTransitions = null, workInProgressRootRenderTargetTime = now() + 500, prepareFreshStack(root2, lanes)) : workInProgressRootIsPrerendering = checkIfRootIsPrerendering(
          root2,
          lanes
        );
        a: do
          try {
            if (0 !== workInProgressSuspendedReason && null !== workInProgress) {
              lanes = workInProgress;
              var thrownValue = workInProgressThrownValue;
              b: switch (workInProgressSuspendedReason) {
                case 1:
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  throwAndUnwindWorkLoop(root2, lanes, thrownValue, 1);
                  break;
                case 2:
                  if (isThenableResolved(thrownValue)) {
                    workInProgressSuspendedReason = 0;
                    workInProgressThrownValue = null;
                    replaySuspendedUnitOfWork(lanes);
                    break;
                  }
                  lanes = function() {
                    2 === workInProgressSuspendedReason && workInProgressRoot === root2 && (workInProgressSuspendedReason = 7);
                    ensureRootIsScheduled(root2);
                  };
                  thrownValue.then(lanes, lanes);
                  break a;
                case 3:
                  workInProgressSuspendedReason = 7;
                  break a;
                case 4:
                  workInProgressSuspendedReason = 5;
                  break a;
                case 7:
                  isThenableResolved(thrownValue) ? (workInProgressSuspendedReason = 0, workInProgressThrownValue = null, replaySuspendedUnitOfWork(lanes)) : (workInProgressSuspendedReason = 0, workInProgressThrownValue = null, throwAndUnwindWorkLoop(root2, lanes, thrownValue, 7));
                  break;
                case 5:
                  var resource = null;
                  switch (workInProgress.tag) {
                    case 26:
                      resource = workInProgress.memoizedState;
                    case 5:
                    case 27:
                      var hostFiber = workInProgress;
                      if (resource ? preloadResource(resource) : 1) {
                        workInProgressSuspendedReason = 0;
                        workInProgressThrownValue = null;
                        var sibling = hostFiber.sibling;
                        if (null !== sibling) workInProgress = sibling;
                        else {
                          var returnFiber = hostFiber.return;
                          null !== returnFiber ? (workInProgress = returnFiber, completeUnitOfWork(returnFiber)) : workInProgress = null;
                        }
                        break b;
                      }
                  }
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  throwAndUnwindWorkLoop(root2, lanes, thrownValue, 5);
                  break;
                case 6:
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  throwAndUnwindWorkLoop(root2, lanes, thrownValue, 6);
                  break;
                case 8:
                  resetWorkInProgressStack();
                  workInProgressRootExitStatus = 6;
                  break a;
                default:
                  throw Error(formatProdErrorMessage(462));
              }
            }
            workLoopConcurrent();
            break;
          } catch (thrownValue$166) {
            handleThrow(root2, thrownValue$166);
          }
        while (1);
        lastContextDependency = currentlyRenderingFiber = null;
        ReactSharedInternals.H = prevDispatcher;
        ReactSharedInternals.A = prevAsyncDispatcher;
        executionContext = prevExecutionContext;
        if (null !== workInProgress) return 0;
        workInProgressRoot = null;
        workInProgressRootRenderLanes = 0;
        finishQueueingConcurrentUpdates();
        return workInProgressRootExitStatus;
      }
      function workLoopConcurrent() {
        for (; null !== workInProgress && !shouldYield(); )
          performUnitOfWork(workInProgress);
      }
      function performUnitOfWork(unitOfWork) {
        var next = beginWork(unitOfWork.alternate, unitOfWork, entangledRenderLanes);
        unitOfWork.memoizedProps = unitOfWork.pendingProps;
        null === next ? completeUnitOfWork(unitOfWork) : workInProgress = next;
      }
      function replaySuspendedUnitOfWork(unitOfWork) {
        var next = unitOfWork;
        var current = next.alternate;
        switch (next.tag) {
          case 15:
          case 0:
            next = replayFunctionComponent(
              current,
              next,
              next.pendingProps,
              next.type,
              void 0,
              workInProgressRootRenderLanes
            );
            break;
          case 11:
            next = replayFunctionComponent(
              current,
              next,
              next.pendingProps,
              next.type.render,
              next.ref,
              workInProgressRootRenderLanes
            );
            break;
          case 5:
            resetHooksOnUnwind(next);
          default:
            unwindInterruptedWork(current, next), next = workInProgress = resetWorkInProgress(next, entangledRenderLanes), next = beginWork(current, next, entangledRenderLanes);
        }
        unitOfWork.memoizedProps = unitOfWork.pendingProps;
        null === next ? completeUnitOfWork(unitOfWork) : workInProgress = next;
      }
      function throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, suspendedReason) {
        lastContextDependency = currentlyRenderingFiber = null;
        resetHooksOnUnwind(unitOfWork);
        thenableState$1 = null;
        thenableIndexCounter$1 = 0;
        var returnFiber = unitOfWork.return;
        try {
          if (throwException(
            root2,
            returnFiber,
            unitOfWork,
            thrownValue,
            workInProgressRootRenderLanes
          )) {
            workInProgressRootExitStatus = 1;
            logUncaughtError(
              root2,
              createCapturedValueAtFiber(thrownValue, root2.current)
            );
            workInProgress = null;
            return;
          }
        } catch (error) {
          if (null !== returnFiber) throw workInProgress = returnFiber, error;
          workInProgressRootExitStatus = 1;
          logUncaughtError(
            root2,
            createCapturedValueAtFiber(thrownValue, root2.current)
          );
          workInProgress = null;
          return;
        }
        if (unitOfWork.flags & 32768) {
          if (isHydrating || 1 === suspendedReason) root2 = true;
          else if (workInProgressRootIsPrerendering || 0 !== (workInProgressRootRenderLanes & 536870912))
            root2 = false;
          else if (workInProgressRootDidSkipSuspendedSiblings = root2 = true, 2 === suspendedReason || 3 === suspendedReason || 6 === suspendedReason)
            suspendedReason = suspenseHandlerStackCursor.current, null !== suspendedReason && 13 === suspendedReason.tag && (suspendedReason.flags |= 16384);
          unwindUnitOfWork(unitOfWork, root2);
        } else completeUnitOfWork(unitOfWork);
      }
      function completeUnitOfWork(unitOfWork) {
        var completedWork = unitOfWork;
        do {
          if (0 !== (completedWork.flags & 32768)) {
            unwindUnitOfWork(
              completedWork,
              workInProgressRootDidSkipSuspendedSiblings
            );
            return;
          }
          unitOfWork = completedWork.return;
          var next = completeWork(
            completedWork.alternate,
            completedWork,
            entangledRenderLanes
          );
          if (null !== next) {
            workInProgress = next;
            return;
          }
          completedWork = completedWork.sibling;
          if (null !== completedWork) {
            workInProgress = completedWork;
            return;
          }
          workInProgress = completedWork = unitOfWork;
        } while (null !== completedWork);
        0 === workInProgressRootExitStatus && (workInProgressRootExitStatus = 5);
      }
      function unwindUnitOfWork(unitOfWork, skipSiblings) {
        do {
          var next = unwindWork(unitOfWork.alternate, unitOfWork);
          if (null !== next) {
            next.flags &= 32767;
            workInProgress = next;
            return;
          }
          next = unitOfWork.return;
          null !== next && (next.flags |= 32768, next.subtreeFlags = 0, next.deletions = null);
          if (!skipSiblings && (unitOfWork = unitOfWork.sibling, null !== unitOfWork)) {
            workInProgress = unitOfWork;
            return;
          }
          workInProgress = unitOfWork = next;
        } while (null !== unitOfWork);
        workInProgressRootExitStatus = 6;
        workInProgress = null;
      }
      function commitRoot(root2, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, spawnedLane, updatedLanes, suspendedRetryLanes, suspendedCommitReason, completedRenderStartTime, completedRenderEndTime) {
        var prevTransition = ReactSharedInternals.T, previousUpdateLanePriority = ReactDOMSharedInternals.p;
        try {
          ReactDOMSharedInternals.p = 2, ReactSharedInternals.T = null, commitRootImpl(
            root2,
            recoverableErrors,
            transitions,
            didIncludeRenderPhaseUpdate,
            previousUpdateLanePriority,
            spawnedLane,
            updatedLanes,
            suspendedRetryLanes,
            suspendedCommitReason,
            completedRenderStartTime,
            completedRenderEndTime
          );
        } finally {
          ReactSharedInternals.T = prevTransition, ReactDOMSharedInternals.p = previousUpdateLanePriority;
        }
      }
      function commitRootImpl(root2, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, renderPriorityLevel, spawnedLane, updatedLanes, suspendedRetryLanes) {
        do
          flushPassiveEffects();
        while (null !== rootWithPendingPassiveEffects);
        if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(327));
        var finishedWork = root2.finishedWork;
        didIncludeRenderPhaseUpdate = root2.finishedLanes;
        if (null === finishedWork) return null;
        root2.finishedWork = null;
        root2.finishedLanes = 0;
        if (finishedWork === root2.current) throw Error(formatProdErrorMessage(177));
        root2.callbackNode = null;
        root2.callbackPriority = 0;
        root2.cancelPendingCommit = null;
        var remainingLanes = finishedWork.lanes | finishedWork.childLanes;
        remainingLanes |= concurrentlyUpdatedLanes;
        markRootFinished(
          root2,
          didIncludeRenderPhaseUpdate,
          remainingLanes,
          spawnedLane,
          updatedLanes,
          suspendedRetryLanes
        );
        root2 === workInProgressRoot && (workInProgress = workInProgressRoot = null, workInProgressRootRenderLanes = 0);
        0 === (finishedWork.subtreeFlags & 10256) && 0 === (finishedWork.flags & 10256) || rootDoesHavePassiveEffects || (rootDoesHavePassiveEffects = true, pendingPassiveEffectsRemainingLanes = remainingLanes, pendingPassiveTransitions = transitions, scheduleCallback$1(NormalPriority$1, function() {
          flushPassiveEffects(true);
          return null;
        }));
        transitions = 0 !== (finishedWork.flags & 15990);
        0 !== (finishedWork.subtreeFlags & 15990) || transitions ? (transitions = ReactSharedInternals.T, ReactSharedInternals.T = null, spawnedLane = ReactDOMSharedInternals.p, ReactDOMSharedInternals.p = 2, updatedLanes = executionContext, executionContext |= 4, commitBeforeMutationEffects(root2, finishedWork), commitMutationEffectsOnFiber(finishedWork, root2), restoreSelection(selectionInformation, root2.containerInfo), _enabled = !!eventsEnabled, selectionInformation = eventsEnabled = null, root2.current = finishedWork, commitLayoutEffectOnFiber(root2, finishedWork.alternate, finishedWork), requestPaint(), executionContext = updatedLanes, ReactDOMSharedInternals.p = spawnedLane, ReactSharedInternals.T = transitions) : root2.current = finishedWork;
        rootDoesHavePassiveEffects ? (rootDoesHavePassiveEffects = false, rootWithPendingPassiveEffects = root2, pendingPassiveEffectsLanes = didIncludeRenderPhaseUpdate) : releaseRootPooledCache(root2, remainingLanes);
        remainingLanes = root2.pendingLanes;
        0 === remainingLanes && (legacyErrorBoundariesThatAlreadyFailed = null);
        onCommitRoot(finishedWork.stateNode, renderPriorityLevel);
        ensureRootIsScheduled(root2);
        if (null !== recoverableErrors)
          for (renderPriorityLevel = root2.onRecoverableError, finishedWork = 0; finishedWork < recoverableErrors.length; finishedWork++)
            remainingLanes = recoverableErrors[finishedWork], renderPriorityLevel(remainingLanes.value, {
              componentStack: remainingLanes.stack
            });
        0 !== (pendingPassiveEffectsLanes & 3) && flushPassiveEffects();
        remainingLanes = root2.pendingLanes;
        0 !== (didIncludeRenderPhaseUpdate & 4194218) && 0 !== (remainingLanes & 42) ? root2 === rootWithNestedUpdates ? nestedUpdateCount++ : (nestedUpdateCount = 0, rootWithNestedUpdates = root2) : nestedUpdateCount = 0;
        flushSyncWorkAcrossRoots_impl(0, false);
        return null;
      }
      function releaseRootPooledCache(root2, remainingLanes) {
        0 === (root2.pooledCacheLanes &= remainingLanes) && (remainingLanes = root2.pooledCache, null != remainingLanes && (root2.pooledCache = null, releaseCache(remainingLanes)));
      }
      function flushPassiveEffects() {
        if (null !== rootWithPendingPassiveEffects) {
          var root$170 = rootWithPendingPassiveEffects, remainingLanes = pendingPassiveEffectsRemainingLanes;
          pendingPassiveEffectsRemainingLanes = 0;
          var renderPriority = lanesToEventPriority(pendingPassiveEffectsLanes), prevTransition = ReactSharedInternals.T, previousPriority = ReactDOMSharedInternals.p;
          try {
            ReactDOMSharedInternals.p = 32 > renderPriority ? 32 : renderPriority;
            ReactSharedInternals.T = null;
            if (null === rootWithPendingPassiveEffects)
              var JSCompiler_inline_result = false;
            else {
              renderPriority = pendingPassiveTransitions;
              pendingPassiveTransitions = null;
              var root2 = rootWithPendingPassiveEffects, lanes = pendingPassiveEffectsLanes;
              rootWithPendingPassiveEffects = null;
              pendingPassiveEffectsLanes = 0;
              if (0 !== (executionContext & 6))
                throw Error(formatProdErrorMessage(331));
              var prevExecutionContext = executionContext;
              executionContext |= 4;
              commitPassiveUnmountOnFiber(root2.current);
              commitPassiveMountOnFiber(root2, root2.current, lanes, renderPriority);
              executionContext = prevExecutionContext;
              flushSyncWorkAcrossRoots_impl(0, false);
              if (injectedHook && "function" === typeof injectedHook.onPostCommitFiberRoot)
                try {
                  injectedHook.onPostCommitFiberRoot(rendererID, root2);
                } catch (err) {
                }
              JSCompiler_inline_result = true;
            }
            return JSCompiler_inline_result;
          } finally {
            ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition, releaseRootPooledCache(root$170, remainingLanes);
          }
        }
        return false;
      }
      function captureCommitPhaseErrorOnRoot(rootFiber, sourceFiber, error) {
        sourceFiber = createCapturedValueAtFiber(error, sourceFiber);
        sourceFiber = createRootErrorUpdate(rootFiber.stateNode, sourceFiber, 2);
        rootFiber = enqueueUpdate(rootFiber, sourceFiber, 2);
        null !== rootFiber && (markRootUpdated$1(rootFiber, 2), ensureRootIsScheduled(rootFiber));
      }
      function captureCommitPhaseError(sourceFiber, nearestMountedAncestor, error) {
        if (3 === sourceFiber.tag)
          captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error);
        else
          for (; null !== nearestMountedAncestor; ) {
            if (3 === nearestMountedAncestor.tag) {
              captureCommitPhaseErrorOnRoot(
                nearestMountedAncestor,
                sourceFiber,
                error
              );
              break;
            } else if (1 === nearestMountedAncestor.tag) {
              var instance = nearestMountedAncestor.stateNode;
              if ("function" === typeof nearestMountedAncestor.type.getDerivedStateFromError || "function" === typeof instance.componentDidCatch && (null === legacyErrorBoundariesThatAlreadyFailed || !legacyErrorBoundariesThatAlreadyFailed.has(instance))) {
                sourceFiber = createCapturedValueAtFiber(error, sourceFiber);
                error = createClassErrorUpdate(2);
                instance = enqueueUpdate(nearestMountedAncestor, error, 2);
                null !== instance && (initializeClassErrorUpdate(
                  error,
                  instance,
                  nearestMountedAncestor,
                  sourceFiber
                ), markRootUpdated$1(instance, 2), ensureRootIsScheduled(instance));
                break;
              }
            }
            nearestMountedAncestor = nearestMountedAncestor.return;
          }
      }
      function attachPingListener(root2, wakeable, lanes) {
        var pingCache = root2.pingCache;
        if (null === pingCache) {
          pingCache = root2.pingCache = new PossiblyWeakMap();
          var threadIDs = /* @__PURE__ */ new Set();
          pingCache.set(wakeable, threadIDs);
        } else
          threadIDs = pingCache.get(wakeable), void 0 === threadIDs && (threadIDs = /* @__PURE__ */ new Set(), pingCache.set(wakeable, threadIDs));
        threadIDs.has(lanes) || (workInProgressRootDidAttachPingListener = true, threadIDs.add(lanes), root2 = pingSuspendedRoot.bind(null, root2, wakeable, lanes), wakeable.then(root2, root2));
      }
      function pingSuspendedRoot(root2, wakeable, pingedLanes) {
        var pingCache = root2.pingCache;
        null !== pingCache && pingCache.delete(wakeable);
        root2.pingedLanes |= root2.suspendedLanes & pingedLanes;
        root2.warmLanes &= ~pingedLanes;
        workInProgressRoot === root2 && (workInProgressRootRenderLanes & pingedLanes) === pingedLanes && (4 === workInProgressRootExitStatus || 3 === workInProgressRootExitStatus && (workInProgressRootRenderLanes & 62914560) === workInProgressRootRenderLanes && 300 > now() - globalMostRecentFallbackTime ? 0 === (executionContext & 2) && prepareFreshStack(root2, 0) : workInProgressRootPingedLanes |= pingedLanes, workInProgressSuspendedRetryLanes === workInProgressRootRenderLanes && (workInProgressSuspendedRetryLanes = 0));
        ensureRootIsScheduled(root2);
      }
      function retryTimedOutBoundary(boundaryFiber, retryLane) {
        0 === retryLane && (retryLane = claimNextRetryLane());
        boundaryFiber = enqueueConcurrentRenderForLane(boundaryFiber, retryLane);
        null !== boundaryFiber && (markRootUpdated$1(boundaryFiber, retryLane), ensureRootIsScheduled(boundaryFiber));
      }
      function retryDehydratedSuspenseBoundary(boundaryFiber) {
        var suspenseState = boundaryFiber.memoizedState, retryLane = 0;
        null !== suspenseState && (retryLane = suspenseState.retryLane);
        retryTimedOutBoundary(boundaryFiber, retryLane);
      }
      function resolveRetryWakeable(boundaryFiber, wakeable) {
        var retryLane = 0;
        switch (boundaryFiber.tag) {
          case 13:
            var retryCache = boundaryFiber.stateNode;
            var suspenseState = boundaryFiber.memoizedState;
            null !== suspenseState && (retryLane = suspenseState.retryLane);
            break;
          case 19:
            retryCache = boundaryFiber.stateNode;
            break;
          case 22:
            retryCache = boundaryFiber.stateNode._retryCache;
            break;
          default:
            throw Error(formatProdErrorMessage(314));
        }
        null !== retryCache && retryCache.delete(wakeable);
        retryTimedOutBoundary(boundaryFiber, retryLane);
      }
      function scheduleCallback$1(priorityLevel, callback) {
        return scheduleCallback$3(priorityLevel, callback);
      }
      var firstScheduledRoot = null;
      var lastScheduledRoot = null;
      var didScheduleMicrotask = false;
      var mightHavePendingSyncWork = false;
      var isFlushingWork = false;
      var currentEventTransitionLane = 0;
      function ensureRootIsScheduled(root2) {
        root2 !== lastScheduledRoot && null === root2.next && (null === lastScheduledRoot ? firstScheduledRoot = lastScheduledRoot = root2 : lastScheduledRoot = lastScheduledRoot.next = root2);
        mightHavePendingSyncWork = true;
        didScheduleMicrotask || (didScheduleMicrotask = true, scheduleImmediateTask(processRootScheduleInMicrotask));
      }
      function flushSyncWorkAcrossRoots_impl(syncTransitionLanes, onlyLegacy) {
        if (!isFlushingWork && mightHavePendingSyncWork) {
          isFlushingWork = true;
          do {
            var didPerformSomeWork = false;
            for (var root$172 = firstScheduledRoot; null !== root$172; ) {
              if (!onlyLegacy)
                if (0 !== syncTransitionLanes) {
                  var pendingLanes = root$172.pendingLanes;
                  if (0 === pendingLanes) var JSCompiler_inline_result = 0;
                  else {
                    var suspendedLanes = root$172.suspendedLanes, pingedLanes = root$172.pingedLanes;
                    JSCompiler_inline_result = (1 << 31 - clz32(42 | syncTransitionLanes) + 1) - 1;
                    JSCompiler_inline_result &= pendingLanes & ~(suspendedLanes & ~pingedLanes);
                    JSCompiler_inline_result = JSCompiler_inline_result & 201326677 ? JSCompiler_inline_result & 201326677 | 1 : JSCompiler_inline_result ? JSCompiler_inline_result | 2 : 0;
                  }
                  0 !== JSCompiler_inline_result && (didPerformSomeWork = true, performSyncWorkOnRoot(root$172, JSCompiler_inline_result));
                } else
                  JSCompiler_inline_result = workInProgressRootRenderLanes, JSCompiler_inline_result = getNextLanes(
                    root$172,
                    root$172 === workInProgressRoot ? JSCompiler_inline_result : 0
                  ), 0 === (JSCompiler_inline_result & 3) || checkIfRootIsPrerendering(root$172, JSCompiler_inline_result) || (didPerformSomeWork = true, performSyncWorkOnRoot(root$172, JSCompiler_inline_result));
              root$172 = root$172.next;
            }
          } while (didPerformSomeWork);
          isFlushingWork = false;
        }
      }
      function processRootScheduleInMicrotask() {
        mightHavePendingSyncWork = didScheduleMicrotask = false;
        var syncTransitionLanes = 0;
        0 !== currentEventTransitionLane && (shouldAttemptEagerTransition() && (syncTransitionLanes = currentEventTransitionLane), currentEventTransitionLane = 0);
        for (var currentTime = now(), prev = null, root2 = firstScheduledRoot; null !== root2; ) {
          var next = root2.next, nextLanes = scheduleTaskForRootDuringMicrotask(root2, currentTime);
          if (0 === nextLanes)
            root2.next = null, null === prev ? firstScheduledRoot = next : prev.next = next, null === next && (lastScheduledRoot = prev);
          else if (prev = root2, 0 !== syncTransitionLanes || 0 !== (nextLanes & 3))
            mightHavePendingSyncWork = true;
          root2 = next;
        }
        flushSyncWorkAcrossRoots_impl(syncTransitionLanes, false);
      }
      function scheduleTaskForRootDuringMicrotask(root2, currentTime) {
        for (var suspendedLanes = root2.suspendedLanes, pingedLanes = root2.pingedLanes, expirationTimes = root2.expirationTimes, lanes = root2.pendingLanes & -62914561; 0 < lanes; ) {
          var index$5 = 31 - clz32(lanes), lane = 1 << index$5, expirationTime = expirationTimes[index$5];
          if (-1 === expirationTime) {
            if (0 === (lane & suspendedLanes) || 0 !== (lane & pingedLanes))
              expirationTimes[index$5] = computeExpirationTime(lane, currentTime);
          } else expirationTime <= currentTime && (root2.expiredLanes |= lane);
          lanes &= ~lane;
        }
        currentTime = workInProgressRoot;
        suspendedLanes = workInProgressRootRenderLanes;
        suspendedLanes = getNextLanes(
          root2,
          root2 === currentTime ? suspendedLanes : 0
        );
        pingedLanes = root2.callbackNode;
        if (0 === suspendedLanes || root2 === currentTime && 2 === workInProgressSuspendedReason || null !== root2.cancelPendingCommit)
          return null !== pingedLanes && null !== pingedLanes && cancelCallback$1(pingedLanes), root2.callbackNode = null, root2.callbackPriority = 0;
        if (0 === (suspendedLanes & 3) || checkIfRootIsPrerendering(root2, suspendedLanes)) {
          currentTime = suspendedLanes & -suspendedLanes;
          if (currentTime === root2.callbackPriority) return currentTime;
          null !== pingedLanes && cancelCallback$1(pingedLanes);
          switch (lanesToEventPriority(suspendedLanes)) {
            case 2:
            case 8:
              suspendedLanes = UserBlockingPriority;
              break;
            case 32:
              suspendedLanes = NormalPriority$1;
              break;
            case 268435456:
              suspendedLanes = IdlePriority;
              break;
            default:
              suspendedLanes = NormalPriority$1;
          }
          pingedLanes = performWorkOnRootViaSchedulerTask.bind(null, root2);
          suspendedLanes = scheduleCallback$3(suspendedLanes, pingedLanes);
          root2.callbackPriority = currentTime;
          root2.callbackNode = suspendedLanes;
          return currentTime;
        }
        null !== pingedLanes && null !== pingedLanes && cancelCallback$1(pingedLanes);
        root2.callbackPriority = 2;
        root2.callbackNode = null;
        return 2;
      }
      function performWorkOnRootViaSchedulerTask(root2, didTimeout) {
        var originalCallbackNode = root2.callbackNode;
        if (flushPassiveEffects() && root2.callbackNode !== originalCallbackNode)
          return null;
        var workInProgressRootRenderLanes$jscomp$0 = workInProgressRootRenderLanes;
        workInProgressRootRenderLanes$jscomp$0 = getNextLanes(
          root2,
          root2 === workInProgressRoot ? workInProgressRootRenderLanes$jscomp$0 : 0
        );
        if (0 === workInProgressRootRenderLanes$jscomp$0) return null;
        performWorkOnRoot(root2, workInProgressRootRenderLanes$jscomp$0, didTimeout);
        scheduleTaskForRootDuringMicrotask(root2, now());
        return null != root2.callbackNode && root2.callbackNode === originalCallbackNode ? performWorkOnRootViaSchedulerTask.bind(null, root2) : null;
      }
      function performSyncWorkOnRoot(root2, lanes) {
        if (flushPassiveEffects()) return null;
        performWorkOnRoot(root2, lanes, true);
      }
      function scheduleImmediateTask(cb) {
        scheduleMicrotask(function() {
          0 !== (executionContext & 6) ? scheduleCallback$3(ImmediatePriority, cb) : cb();
        });
      }
      function requestTransitionLane() {
        0 === currentEventTransitionLane && (currentEventTransitionLane = claimNextTransitionLane());
        return currentEventTransitionLane;
      }
      function coerceFormActionProp(actionProp) {
        return null == actionProp || "symbol" === typeof actionProp || "boolean" === typeof actionProp ? null : "function" === typeof actionProp ? actionProp : sanitizeURL("" + actionProp);
      }
      function createFormDataWithSubmitter(form, submitter) {
        var temp = submitter.ownerDocument.createElement("input");
        temp.name = submitter.name;
        temp.value = submitter.value;
        form.id && temp.setAttribute("form", form.id);
        submitter.parentNode.insertBefore(temp, submitter);
        form = new FormData(form);
        temp.parentNode.removeChild(temp);
        return form;
      }
      function extractEvents$1(dispatchQueue, domEventName, maybeTargetInst, nativeEvent, nativeEventTarget) {
        if ("submit" === domEventName && maybeTargetInst && maybeTargetInst.stateNode === nativeEventTarget) {
          var action = coerceFormActionProp(
            (nativeEventTarget[internalPropsKey] || null).action
          ), submitter = nativeEvent.submitter;
          submitter && (domEventName = (domEventName = submitter[internalPropsKey] || null) ? coerceFormActionProp(domEventName.formAction) : submitter.getAttribute("formAction"), null !== domEventName && (action = domEventName, submitter = null));
          var event = new SyntheticEvent(
            "action",
            "action",
            null,
            nativeEvent,
            nativeEventTarget
          );
          dispatchQueue.push({
            event,
            listeners: [
              {
                instance: null,
                listener: function() {
                  if (nativeEvent.defaultPrevented) {
                    if (0 !== currentEventTransitionLane) {
                      var formData = submitter ? createFormDataWithSubmitter(nativeEventTarget, submitter) : new FormData(nativeEventTarget);
                      startHostTransition(
                        maybeTargetInst,
                        {
                          pending: true,
                          data: formData,
                          method: nativeEventTarget.method,
                          action
                        },
                        null,
                        formData
                      );
                    }
                  } else
                    "function" === typeof action && (event.preventDefault(), formData = submitter ? createFormDataWithSubmitter(nativeEventTarget, submitter) : new FormData(nativeEventTarget), startHostTransition(
                      maybeTargetInst,
                      {
                        pending: true,
                        data: formData,
                        method: nativeEventTarget.method,
                        action
                      },
                      action,
                      formData
                    ));
                },
                currentTarget: nativeEventTarget
              }
            ]
          });
        }
      }
      for (i$jscomp$inline_1439 = 0; i$jscomp$inline_1439 < simpleEventPluginEvents.length; i$jscomp$inline_1439++) {
        eventName$jscomp$inline_1440 = simpleEventPluginEvents[i$jscomp$inline_1439], domEventName$jscomp$inline_1441 = eventName$jscomp$inline_1440.toLowerCase(), capitalizedEvent$jscomp$inline_1442 = eventName$jscomp$inline_1440[0].toUpperCase() + eventName$jscomp$inline_1440.slice(1);
        registerSimpleEvent(
          domEventName$jscomp$inline_1441,
          "on" + capitalizedEvent$jscomp$inline_1442
        );
      }
      var eventName$jscomp$inline_1440;
      var domEventName$jscomp$inline_1441;
      var capitalizedEvent$jscomp$inline_1442;
      var i$jscomp$inline_1439;
      registerSimpleEvent(ANIMATION_END, "onAnimationEnd");
      registerSimpleEvent(ANIMATION_ITERATION, "onAnimationIteration");
      registerSimpleEvent(ANIMATION_START, "onAnimationStart");
      registerSimpleEvent("dblclick", "onDoubleClick");
      registerSimpleEvent("focusin", "onFocus");
      registerSimpleEvent("focusout", "onBlur");
      registerSimpleEvent(TRANSITION_RUN, "onTransitionRun");
      registerSimpleEvent(TRANSITION_START, "onTransitionStart");
      registerSimpleEvent(TRANSITION_CANCEL, "onTransitionCancel");
      registerSimpleEvent(TRANSITION_END, "onTransitionEnd");
      registerDirectEvent("onMouseEnter", ["mouseout", "mouseover"]);
      registerDirectEvent("onMouseLeave", ["mouseout", "mouseover"]);
      registerDirectEvent("onPointerEnter", ["pointerout", "pointerover"]);
      registerDirectEvent("onPointerLeave", ["pointerout", "pointerover"]);
      registerTwoPhaseEvent(
        "onChange",
        "change click focusin focusout input keydown keyup selectionchange".split(" ")
      );
      registerTwoPhaseEvent(
        "onSelect",
        "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
          " "
        )
      );
      registerTwoPhaseEvent("onBeforeInput", [
        "compositionend",
        "keypress",
        "textInput",
        "paste"
      ]);
      registerTwoPhaseEvent(
        "onCompositionEnd",
        "compositionend focusout keydown keypress keyup mousedown".split(" ")
      );
      registerTwoPhaseEvent(
        "onCompositionStart",
        "compositionstart focusout keydown keypress keyup mousedown".split(" ")
      );
      registerTwoPhaseEvent(
        "onCompositionUpdate",
        "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
      );
      var mediaEventTypes = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
        " "
      );
      var nonDelegatedEvents = new Set(
        "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(mediaEventTypes)
      );
      function processDispatchQueue(dispatchQueue, eventSystemFlags) {
        eventSystemFlags = 0 !== (eventSystemFlags & 4);
        for (var i = 0; i < dispatchQueue.length; i++) {
          var _dispatchQueue$i = dispatchQueue[i], event = _dispatchQueue$i.event;
          _dispatchQueue$i = _dispatchQueue$i.listeners;
          a: {
            var previousInstance = void 0;
            if (eventSystemFlags)
              for (var i$jscomp$0 = _dispatchQueue$i.length - 1; 0 <= i$jscomp$0; i$jscomp$0--) {
                var _dispatchListeners$i = _dispatchQueue$i[i$jscomp$0], instance = _dispatchListeners$i.instance, currentTarget = _dispatchListeners$i.currentTarget;
                _dispatchListeners$i = _dispatchListeners$i.listener;
                if (instance !== previousInstance && event.isPropagationStopped())
                  break a;
                previousInstance = _dispatchListeners$i;
                event.currentTarget = currentTarget;
                try {
                  previousInstance(event);
                } catch (error) {
                  reportGlobalError(error);
                }
                event.currentTarget = null;
                previousInstance = instance;
              }
            else
              for (i$jscomp$0 = 0; i$jscomp$0 < _dispatchQueue$i.length; i$jscomp$0++) {
                _dispatchListeners$i = _dispatchQueue$i[i$jscomp$0];
                instance = _dispatchListeners$i.instance;
                currentTarget = _dispatchListeners$i.currentTarget;
                _dispatchListeners$i = _dispatchListeners$i.listener;
                if (instance !== previousInstance && event.isPropagationStopped())
                  break a;
                previousInstance = _dispatchListeners$i;
                event.currentTarget = currentTarget;
                try {
                  previousInstance(event);
                } catch (error) {
                  reportGlobalError(error);
                }
                event.currentTarget = null;
                previousInstance = instance;
              }
          }
        }
      }
      function listenToNonDelegatedEvent(domEventName, targetElement) {
        var JSCompiler_inline_result = targetElement[internalEventHandlersKey];
        void 0 === JSCompiler_inline_result && (JSCompiler_inline_result = targetElement[internalEventHandlersKey] = /* @__PURE__ */ new Set());
        var listenerSetKey = domEventName + "__bubble";
        JSCompiler_inline_result.has(listenerSetKey) || (addTrappedEventListener(targetElement, domEventName, 2, false), JSCompiler_inline_result.add(listenerSetKey));
      }
      function listenToNativeEvent(domEventName, isCapturePhaseListener, target) {
        var eventSystemFlags = 0;
        isCapturePhaseListener && (eventSystemFlags |= 4);
        addTrappedEventListener(
          target,
          domEventName,
          eventSystemFlags,
          isCapturePhaseListener
        );
      }
      var listeningMarker = "_reactListening" + Math.random().toString(36).slice(2);
      function listenToAllSupportedEvents(rootContainerElement) {
        if (!rootContainerElement[listeningMarker]) {
          rootContainerElement[listeningMarker] = true;
          allNativeEvents.forEach(function(domEventName) {
            "selectionchange" !== domEventName && (nonDelegatedEvents.has(domEventName) || listenToNativeEvent(domEventName, false, rootContainerElement), listenToNativeEvent(domEventName, true, rootContainerElement));
          });
          var ownerDocument = 9 === rootContainerElement.nodeType ? rootContainerElement : rootContainerElement.ownerDocument;
          null === ownerDocument || ownerDocument[listeningMarker] || (ownerDocument[listeningMarker] = true, listenToNativeEvent("selectionchange", false, ownerDocument));
        }
      }
      function addTrappedEventListener(targetContainer, domEventName, eventSystemFlags, isCapturePhaseListener) {
        switch (getEventPriority(domEventName)) {
          case 2:
            var listenerWrapper = dispatchDiscreteEvent;
            break;
          case 8:
            listenerWrapper = dispatchContinuousEvent;
            break;
          default:
            listenerWrapper = dispatchEvent;
        }
        eventSystemFlags = listenerWrapper.bind(
          null,
          domEventName,
          eventSystemFlags,
          targetContainer
        );
        listenerWrapper = void 0;
        !passiveBrowserEventsSupported || "touchstart" !== domEventName && "touchmove" !== domEventName && "wheel" !== domEventName || (listenerWrapper = true);
        isCapturePhaseListener ? void 0 !== listenerWrapper ? targetContainer.addEventListener(domEventName, eventSystemFlags, {
          capture: true,
          passive: listenerWrapper
        }) : targetContainer.addEventListener(domEventName, eventSystemFlags, true) : void 0 !== listenerWrapper ? targetContainer.addEventListener(domEventName, eventSystemFlags, {
          passive: listenerWrapper
        }) : targetContainer.addEventListener(domEventName, eventSystemFlags, false);
      }
      function dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, targetInst$jscomp$0, targetContainer) {
        var ancestorInst = targetInst$jscomp$0;
        if (0 === (eventSystemFlags & 1) && 0 === (eventSystemFlags & 2) && null !== targetInst$jscomp$0)
          a: for (; ; ) {
            if (null === targetInst$jscomp$0) return;
            var nodeTag = targetInst$jscomp$0.tag;
            if (3 === nodeTag || 4 === nodeTag) {
              var container = targetInst$jscomp$0.stateNode.containerInfo;
              if (container === targetContainer || 8 === container.nodeType && container.parentNode === targetContainer)
                break;
              if (4 === nodeTag)
                for (nodeTag = targetInst$jscomp$0.return; null !== nodeTag; ) {
                  var grandTag = nodeTag.tag;
                  if (3 === grandTag || 4 === grandTag) {
                    if (grandTag = nodeTag.stateNode.containerInfo, grandTag === targetContainer || 8 === grandTag.nodeType && grandTag.parentNode === targetContainer)
                      return;
                  }
                  nodeTag = nodeTag.return;
                }
              for (; null !== container; ) {
                nodeTag = getClosestInstanceFromNode(container);
                if (null === nodeTag) return;
                grandTag = nodeTag.tag;
                if (5 === grandTag || 6 === grandTag || 26 === grandTag || 27 === grandTag) {
                  targetInst$jscomp$0 = ancestorInst = nodeTag;
                  continue a;
                }
                container = container.parentNode;
              }
            }
            targetInst$jscomp$0 = targetInst$jscomp$0.return;
          }
        batchedUpdates$1(function() {
          var targetInst = ancestorInst, nativeEventTarget = getEventTarget(nativeEvent), dispatchQueue = [];
          a: {
            var reactName = topLevelEventsToReactNames.get(domEventName);
            if (void 0 !== reactName) {
              var SyntheticEventCtor = SyntheticEvent, reactEventType = domEventName;
              switch (domEventName) {
                case "keypress":
                  if (0 === getEventCharCode(nativeEvent)) break a;
                case "keydown":
                case "keyup":
                  SyntheticEventCtor = SyntheticKeyboardEvent;
                  break;
                case "focusin":
                  reactEventType = "focus";
                  SyntheticEventCtor = SyntheticFocusEvent;
                  break;
                case "focusout":
                  reactEventType = "blur";
                  SyntheticEventCtor = SyntheticFocusEvent;
                  break;
                case "beforeblur":
                case "afterblur":
                  SyntheticEventCtor = SyntheticFocusEvent;
                  break;
                case "click":
                  if (2 === nativeEvent.button) break a;
                case "auxclick":
                case "dblclick":
                case "mousedown":
                case "mousemove":
                case "mouseup":
                case "mouseout":
                case "mouseover":
                case "contextmenu":
                  SyntheticEventCtor = SyntheticMouseEvent;
                  break;
                case "drag":
                case "dragend":
                case "dragenter":
                case "dragexit":
                case "dragleave":
                case "dragover":
                case "dragstart":
                case "drop":
                  SyntheticEventCtor = SyntheticDragEvent;
                  break;
                case "touchcancel":
                case "touchend":
                case "touchmove":
                case "touchstart":
                  SyntheticEventCtor = SyntheticTouchEvent;
                  break;
                case ANIMATION_END:
                case ANIMATION_ITERATION:
                case ANIMATION_START:
                  SyntheticEventCtor = SyntheticAnimationEvent;
                  break;
                case TRANSITION_END:
                  SyntheticEventCtor = SyntheticTransitionEvent;
                  break;
                case "scroll":
                case "scrollend":
                  SyntheticEventCtor = SyntheticUIEvent;
                  break;
                case "wheel":
                  SyntheticEventCtor = SyntheticWheelEvent;
                  break;
                case "copy":
                case "cut":
                case "paste":
                  SyntheticEventCtor = SyntheticClipboardEvent;
                  break;
                case "gotpointercapture":
                case "lostpointercapture":
                case "pointercancel":
                case "pointerdown":
                case "pointermove":
                case "pointerout":
                case "pointerover":
                case "pointerup":
                  SyntheticEventCtor = SyntheticPointerEvent;
                  break;
                case "toggle":
                case "beforetoggle":
                  SyntheticEventCtor = SyntheticToggleEvent;
              }
              var inCapturePhase = 0 !== (eventSystemFlags & 4), accumulateTargetOnly = !inCapturePhase && ("scroll" === domEventName || "scrollend" === domEventName), reactEventName = inCapturePhase ? null !== reactName ? reactName + "Capture" : null : reactName;
              inCapturePhase = [];
              for (var instance = targetInst, lastHostComponent; null !== instance; ) {
                var _instance = instance;
                lastHostComponent = _instance.stateNode;
                _instance = _instance.tag;
                5 !== _instance && 26 !== _instance && 27 !== _instance || null === lastHostComponent || null === reactEventName || (_instance = getListener(instance, reactEventName), null != _instance && inCapturePhase.push(
                  createDispatchListener(instance, _instance, lastHostComponent)
                ));
                if (accumulateTargetOnly) break;
                instance = instance.return;
              }
              0 < inCapturePhase.length && (reactName = new SyntheticEventCtor(
                reactName,
                reactEventType,
                null,
                nativeEvent,
                nativeEventTarget
              ), dispatchQueue.push({ event: reactName, listeners: inCapturePhase }));
            }
          }
          if (0 === (eventSystemFlags & 7)) {
            a: {
              reactName = "mouseover" === domEventName || "pointerover" === domEventName;
              SyntheticEventCtor = "mouseout" === domEventName || "pointerout" === domEventName;
              if (reactName && nativeEvent !== currentReplayingEvent && (reactEventType = nativeEvent.relatedTarget || nativeEvent.fromElement) && (getClosestInstanceFromNode(reactEventType) || reactEventType[internalContainerInstanceKey]))
                break a;
              if (SyntheticEventCtor || reactName) {
                reactName = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget : (reactName = nativeEventTarget.ownerDocument) ? reactName.defaultView || reactName.parentWindow : window;
                if (SyntheticEventCtor) {
                  if (reactEventType = nativeEvent.relatedTarget || nativeEvent.toElement, SyntheticEventCtor = targetInst, reactEventType = reactEventType ? getClosestInstanceFromNode(reactEventType) : null, null !== reactEventType && (accumulateTargetOnly = getNearestMountedFiber(reactEventType), inCapturePhase = reactEventType.tag, reactEventType !== accumulateTargetOnly || 5 !== inCapturePhase && 27 !== inCapturePhase && 6 !== inCapturePhase))
                    reactEventType = null;
                } else SyntheticEventCtor = null, reactEventType = targetInst;
                if (SyntheticEventCtor !== reactEventType) {
                  inCapturePhase = SyntheticMouseEvent;
                  _instance = "onMouseLeave";
                  reactEventName = "onMouseEnter";
                  instance = "mouse";
                  if ("pointerout" === domEventName || "pointerover" === domEventName)
                    inCapturePhase = SyntheticPointerEvent, _instance = "onPointerLeave", reactEventName = "onPointerEnter", instance = "pointer";
                  accumulateTargetOnly = null == SyntheticEventCtor ? reactName : getNodeFromInstance(SyntheticEventCtor);
                  lastHostComponent = null == reactEventType ? reactName : getNodeFromInstance(reactEventType);
                  reactName = new inCapturePhase(
                    _instance,
                    instance + "leave",
                    SyntheticEventCtor,
                    nativeEvent,
                    nativeEventTarget
                  );
                  reactName.target = accumulateTargetOnly;
                  reactName.relatedTarget = lastHostComponent;
                  _instance = null;
                  getClosestInstanceFromNode(nativeEventTarget) === targetInst && (inCapturePhase = new inCapturePhase(
                    reactEventName,
                    instance + "enter",
                    reactEventType,
                    nativeEvent,
                    nativeEventTarget
                  ), inCapturePhase.target = lastHostComponent, inCapturePhase.relatedTarget = accumulateTargetOnly, _instance = inCapturePhase);
                  accumulateTargetOnly = _instance;
                  if (SyntheticEventCtor && reactEventType)
                    b: {
                      inCapturePhase = SyntheticEventCtor;
                      reactEventName = reactEventType;
                      instance = 0;
                      for (lastHostComponent = inCapturePhase; lastHostComponent; lastHostComponent = getParent(lastHostComponent))
                        instance++;
                      lastHostComponent = 0;
                      for (_instance = reactEventName; _instance; _instance = getParent(_instance))
                        lastHostComponent++;
                      for (; 0 < instance - lastHostComponent; )
                        inCapturePhase = getParent(inCapturePhase), instance--;
                      for (; 0 < lastHostComponent - instance; )
                        reactEventName = getParent(reactEventName), lastHostComponent--;
                      for (; instance--; ) {
                        if (inCapturePhase === reactEventName || null !== reactEventName && inCapturePhase === reactEventName.alternate)
                          break b;
                        inCapturePhase = getParent(inCapturePhase);
                        reactEventName = getParent(reactEventName);
                      }
                      inCapturePhase = null;
                    }
                  else inCapturePhase = null;
                  null !== SyntheticEventCtor && accumulateEnterLeaveListenersForEvent(
                    dispatchQueue,
                    reactName,
                    SyntheticEventCtor,
                    inCapturePhase,
                    false
                  );
                  null !== reactEventType && null !== accumulateTargetOnly && accumulateEnterLeaveListenersForEvent(
                    dispatchQueue,
                    accumulateTargetOnly,
                    reactEventType,
                    inCapturePhase,
                    true
                  );
                }
              }
            }
            a: {
              reactName = targetInst ? getNodeFromInstance(targetInst) : window;
              SyntheticEventCtor = reactName.nodeName && reactName.nodeName.toLowerCase();
              if ("select" === SyntheticEventCtor || "input" === SyntheticEventCtor && "file" === reactName.type)
                var getTargetInstFunc = getTargetInstForChangeEvent;
              else if (isTextInputElement(reactName))
                if (isInputEventSupported)
                  getTargetInstFunc = getTargetInstForInputOrChangeEvent;
                else {
                  getTargetInstFunc = getTargetInstForInputEventPolyfill;
                  var handleEventFunc = handleEventsForInputEventPolyfill;
                }
              else
                SyntheticEventCtor = reactName.nodeName, !SyntheticEventCtor || "input" !== SyntheticEventCtor.toLowerCase() || "checkbox" !== reactName.type && "radio" !== reactName.type ? targetInst && isCustomElement(targetInst.elementType) && (getTargetInstFunc = getTargetInstForChangeEvent) : getTargetInstFunc = getTargetInstForClickEvent;
              if (getTargetInstFunc && (getTargetInstFunc = getTargetInstFunc(domEventName, targetInst))) {
                createAndAccumulateChangeEvent(
                  dispatchQueue,
                  getTargetInstFunc,
                  nativeEvent,
                  nativeEventTarget
                );
                break a;
              }
              handleEventFunc && handleEventFunc(domEventName, reactName, targetInst);
              "focusout" === domEventName && targetInst && "number" === reactName.type && null != targetInst.memoizedProps.value && setDefaultValue(reactName, "number", reactName.value);
            }
            handleEventFunc = targetInst ? getNodeFromInstance(targetInst) : window;
            switch (domEventName) {
              case "focusin":
                if (isTextInputElement(handleEventFunc) || "true" === handleEventFunc.contentEditable)
                  activeElement = handleEventFunc, activeElementInst = targetInst, lastSelection = null;
                break;
              case "focusout":
                lastSelection = activeElementInst = activeElement = null;
                break;
              case "mousedown":
                mouseDown = true;
                break;
              case "contextmenu":
              case "mouseup":
              case "dragend":
                mouseDown = false;
                constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
                break;
              case "selectionchange":
                if (skipSelectionChangeEvent) break;
              case "keydown":
              case "keyup":
                constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
            }
            var fallbackData;
            if (canUseCompositionEvent)
              b: {
                switch (domEventName) {
                  case "compositionstart":
                    var eventType = "onCompositionStart";
                    break b;
                  case "compositionend":
                    eventType = "onCompositionEnd";
                    break b;
                  case "compositionupdate":
                    eventType = "onCompositionUpdate";
                    break b;
                }
                eventType = void 0;
              }
            else
              isComposing ? isFallbackCompositionEnd(domEventName, nativeEvent) && (eventType = "onCompositionEnd") : "keydown" === domEventName && 229 === nativeEvent.keyCode && (eventType = "onCompositionStart");
            eventType && (useFallbackCompositionData && "ko" !== nativeEvent.locale && (isComposing || "onCompositionStart" !== eventType ? "onCompositionEnd" === eventType && isComposing && (fallbackData = getData()) : (root = nativeEventTarget, startText = "value" in root ? root.value : root.textContent, isComposing = true)), handleEventFunc = accumulateTwoPhaseListeners(targetInst, eventType), 0 < handleEventFunc.length && (eventType = new SyntheticCompositionEvent(
              eventType,
              domEventName,
              null,
              nativeEvent,
              nativeEventTarget
            ), dispatchQueue.push({ event: eventType, listeners: handleEventFunc }), fallbackData ? eventType.data = fallbackData : (fallbackData = getDataFromCustomEvent(nativeEvent), null !== fallbackData && (eventType.data = fallbackData))));
            if (fallbackData = canUseTextInputEvent ? getNativeBeforeInputChars(domEventName, nativeEvent) : getFallbackBeforeInputChars(domEventName, nativeEvent))
              eventType = accumulateTwoPhaseListeners(targetInst, "onBeforeInput"), 0 < eventType.length && (handleEventFunc = new SyntheticCompositionEvent(
                "onBeforeInput",
                "beforeinput",
                null,
                nativeEvent,
                nativeEventTarget
              ), dispatchQueue.push({
                event: handleEventFunc,
                listeners: eventType
              }), handleEventFunc.data = fallbackData);
            extractEvents$1(
              dispatchQueue,
              domEventName,
              targetInst,
              nativeEvent,
              nativeEventTarget
            );
          }
          processDispatchQueue(dispatchQueue, eventSystemFlags);
        });
      }
      function createDispatchListener(instance, listener, currentTarget) {
        return {
          instance,
          listener,
          currentTarget
        };
      }
      function accumulateTwoPhaseListeners(targetFiber, reactName) {
        for (var captureName = reactName + "Capture", listeners = []; null !== targetFiber; ) {
          var _instance2 = targetFiber, stateNode = _instance2.stateNode;
          _instance2 = _instance2.tag;
          5 !== _instance2 && 26 !== _instance2 && 27 !== _instance2 || null === stateNode || (_instance2 = getListener(targetFiber, captureName), null != _instance2 && listeners.unshift(
            createDispatchListener(targetFiber, _instance2, stateNode)
          ), _instance2 = getListener(targetFiber, reactName), null != _instance2 && listeners.push(
            createDispatchListener(targetFiber, _instance2, stateNode)
          ));
          targetFiber = targetFiber.return;
        }
        return listeners;
      }
      function getParent(inst) {
        if (null === inst) return null;
        do
          inst = inst.return;
        while (inst && 5 !== inst.tag && 27 !== inst.tag);
        return inst ? inst : null;
      }
      function accumulateEnterLeaveListenersForEvent(dispatchQueue, event, target, common, inCapturePhase) {
        for (var registrationName = event._reactName, listeners = []; null !== target && target !== common; ) {
          var _instance3 = target, alternate = _instance3.alternate, stateNode = _instance3.stateNode;
          _instance3 = _instance3.tag;
          if (null !== alternate && alternate === common) break;
          5 !== _instance3 && 26 !== _instance3 && 27 !== _instance3 || null === stateNode || (alternate = stateNode, inCapturePhase ? (stateNode = getListener(target, registrationName), null != stateNode && listeners.unshift(
            createDispatchListener(target, stateNode, alternate)
          )) : inCapturePhase || (stateNode = getListener(target, registrationName), null != stateNode && listeners.push(
            createDispatchListener(target, stateNode, alternate)
          )));
          target = target.return;
        }
        0 !== listeners.length && dispatchQueue.push({ event, listeners });
      }
      var NORMALIZE_NEWLINES_REGEX = /\r\n?/g;
      var NORMALIZE_NULL_AND_REPLACEMENT_REGEX = /\u0000|\uFFFD/g;
      function normalizeMarkupForTextOrAttribute(markup) {
        return ("string" === typeof markup ? markup : "" + markup).replace(NORMALIZE_NEWLINES_REGEX, "\n").replace(NORMALIZE_NULL_AND_REPLACEMENT_REGEX, "");
      }
      function checkForUnmatchedText(serverText, clientText) {
        clientText = normalizeMarkupForTextOrAttribute(clientText);
        return normalizeMarkupForTextOrAttribute(serverText) === clientText ? true : false;
      }
      function noop$1() {
      }
      function setProp(domElement, tag, key, value, props, prevValue) {
        switch (key) {
          case "children":
            "string" === typeof value ? "body" === tag || "textarea" === tag && "" === value || setTextContent(domElement, value) : ("number" === typeof value || "bigint" === typeof value) && "body" !== tag && setTextContent(domElement, "" + value);
            break;
          case "className":
            setValueForKnownAttribute(domElement, "class", value);
            break;
          case "tabIndex":
            setValueForKnownAttribute(domElement, "tabindex", value);
            break;
          case "dir":
          case "role":
          case "viewBox":
          case "width":
          case "height":
            setValueForKnownAttribute(domElement, key, value);
            break;
          case "style":
            setValueForStyles(domElement, value, prevValue);
            break;
          case "data":
            if ("object" !== tag) {
              setValueForKnownAttribute(domElement, "data", value);
              break;
            }
          case "src":
          case "href":
            if ("" === value && ("a" !== tag || "href" !== key)) {
              domElement.removeAttribute(key);
              break;
            }
            if (null == value || "function" === typeof value || "symbol" === typeof value || "boolean" === typeof value) {
              domElement.removeAttribute(key);
              break;
            }
            value = sanitizeURL("" + value);
            domElement.setAttribute(key, value);
            break;
          case "action":
          case "formAction":
            if ("function" === typeof value) {
              domElement.setAttribute(
                key,
                "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
              );
              break;
            } else
              "function" === typeof prevValue && ("formAction" === key ? ("input" !== tag && setProp(domElement, tag, "name", props.name, props, null), setProp(
                domElement,
                tag,
                "formEncType",
                props.formEncType,
                props,
                null
              ), setProp(
                domElement,
                tag,
                "formMethod",
                props.formMethod,
                props,
                null
              ), setProp(
                domElement,
                tag,
                "formTarget",
                props.formTarget,
                props,
                null
              )) : (setProp(domElement, tag, "encType", props.encType, props, null), setProp(domElement, tag, "method", props.method, props, null), setProp(domElement, tag, "target", props.target, props, null)));
            if (null == value || "symbol" === typeof value || "boolean" === typeof value) {
              domElement.removeAttribute(key);
              break;
            }
            value = sanitizeURL("" + value);
            domElement.setAttribute(key, value);
            break;
          case "onClick":
            null != value && (domElement.onclick = noop$1);
            break;
          case "onScroll":
            null != value && listenToNonDelegatedEvent("scroll", domElement);
            break;
          case "onScrollEnd":
            null != value && listenToNonDelegatedEvent("scrollend", domElement);
            break;
          case "dangerouslySetInnerHTML":
            if (null != value) {
              if ("object" !== typeof value || !("__html" in value))
                throw Error(formatProdErrorMessage(61));
              key = value.__html;
              if (null != key) {
                if (null != props.children) throw Error(formatProdErrorMessage(60));
                domElement.innerHTML = key;
              }
            }
            break;
          case "multiple":
            domElement.multiple = value && "function" !== typeof value && "symbol" !== typeof value;
            break;
          case "muted":
            domElement.muted = value && "function" !== typeof value && "symbol" !== typeof value;
            break;
          case "suppressContentEditableWarning":
          case "suppressHydrationWarning":
          case "defaultValue":
          case "defaultChecked":
          case "innerHTML":
          case "ref":
            break;
          case "autoFocus":
            break;
          case "xlinkHref":
            if (null == value || "function" === typeof value || "boolean" === typeof value || "symbol" === typeof value) {
              domElement.removeAttribute("xlink:href");
              break;
            }
            key = sanitizeURL("" + value);
            domElement.setAttributeNS(
              "http://www.w3.org/1999/xlink",
              "xlink:href",
              key
            );
            break;
          case "contentEditable":
          case "spellCheck":
          case "draggable":
          case "value":
          case "autoReverse":
          case "externalResourcesRequired":
          case "focusable":
          case "preserveAlpha":
            null != value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, "" + value) : domElement.removeAttribute(key);
            break;
          case "inert":
          case "allowFullScreen":
          case "async":
          case "autoPlay":
          case "controls":
          case "default":
          case "defer":
          case "disabled":
          case "disablePictureInPicture":
          case "disableRemotePlayback":
          case "formNoValidate":
          case "hidden":
          case "loop":
          case "noModule":
          case "noValidate":
          case "open":
          case "playsInline":
          case "readOnly":
          case "required":
          case "reversed":
          case "scoped":
          case "seamless":
          case "itemScope":
            value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, "") : domElement.removeAttribute(key);
            break;
          case "capture":
          case "download":
            true === value ? domElement.setAttribute(key, "") : false !== value && null != value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
            break;
          case "cols":
          case "rows":
          case "size":
          case "span":
            null != value && "function" !== typeof value && "symbol" !== typeof value && !isNaN(value) && 1 <= value ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
            break;
          case "rowSpan":
          case "start":
            null == value || "function" === typeof value || "symbol" === typeof value || isNaN(value) ? domElement.removeAttribute(key) : domElement.setAttribute(key, value);
            break;
          case "popover":
            listenToNonDelegatedEvent("beforetoggle", domElement);
            listenToNonDelegatedEvent("toggle", domElement);
            setValueForAttribute(domElement, "popover", value);
            break;
          case "xlinkActuate":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:actuate",
              value
            );
            break;
          case "xlinkArcrole":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:arcrole",
              value
            );
            break;
          case "xlinkRole":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:role",
              value
            );
            break;
          case "xlinkShow":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:show",
              value
            );
            break;
          case "xlinkTitle":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:title",
              value
            );
            break;
          case "xlinkType":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:type",
              value
            );
            break;
          case "xmlBase":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/XML/1998/namespace",
              "xml:base",
              value
            );
            break;
          case "xmlLang":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/XML/1998/namespace",
              "xml:lang",
              value
            );
            break;
          case "xmlSpace":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/XML/1998/namespace",
              "xml:space",
              value
            );
            break;
          case "is":
            setValueForAttribute(domElement, "is", value);
            break;
          case "innerText":
          case "textContent":
            break;
          default:
            if (!(2 < key.length) || "o" !== key[0] && "O" !== key[0] || "n" !== key[1] && "N" !== key[1])
              key = aliases.get(key) || key, setValueForAttribute(domElement, key, value);
        }
      }
      function setPropOnCustomElement(domElement, tag, key, value, props, prevValue) {
        switch (key) {
          case "style":
            setValueForStyles(domElement, value, prevValue);
            break;
          case "dangerouslySetInnerHTML":
            if (null != value) {
              if ("object" !== typeof value || !("__html" in value))
                throw Error(formatProdErrorMessage(61));
              key = value.__html;
              if (null != key) {
                if (null != props.children) throw Error(formatProdErrorMessage(60));
                domElement.innerHTML = key;
              }
            }
            break;
          case "children":
            "string" === typeof value ? setTextContent(domElement, value) : ("number" === typeof value || "bigint" === typeof value) && setTextContent(domElement, "" + value);
            break;
          case "onScroll":
            null != value && listenToNonDelegatedEvent("scroll", domElement);
            break;
          case "onScrollEnd":
            null != value && listenToNonDelegatedEvent("scrollend", domElement);
            break;
          case "onClick":
            null != value && (domElement.onclick = noop$1);
            break;
          case "suppressContentEditableWarning":
          case "suppressHydrationWarning":
          case "innerHTML":
          case "ref":
            break;
          case "innerText":
          case "textContent":
            break;
          default:
            if (!registrationNameDependencies.hasOwnProperty(key))
              a: {
                if ("o" === key[0] && "n" === key[1] && (props = key.endsWith("Capture"), tag = key.slice(2, props ? key.length - 7 : void 0), prevValue = domElement[internalPropsKey] || null, prevValue = null != prevValue ? prevValue[key] : null, "function" === typeof prevValue && domElement.removeEventListener(tag, prevValue, props), "function" === typeof value)) {
                  "function" !== typeof prevValue && null !== prevValue && (key in domElement ? domElement[key] = null : domElement.hasAttribute(key) && domElement.removeAttribute(key));
                  domElement.addEventListener(tag, value, props);
                  break a;
                }
                key in domElement ? domElement[key] = value : true === value ? domElement.setAttribute(key, "") : setValueForAttribute(domElement, key, value);
              }
        }
      }
      function setInitialProperties(domElement, tag, props) {
        switch (tag) {
          case "div":
          case "span":
          case "svg":
          case "path":
          case "a":
          case "g":
          case "p":
          case "li":
            break;
          case "img":
            listenToNonDelegatedEvent("error", domElement);
            listenToNonDelegatedEvent("load", domElement);
            var hasSrc = false, hasSrcSet = false, propKey;
            for (propKey in props)
              if (props.hasOwnProperty(propKey)) {
                var propValue = props[propKey];
                if (null != propValue)
                  switch (propKey) {
                    case "src":
                      hasSrc = true;
                      break;
                    case "srcSet":
                      hasSrcSet = true;
                      break;
                    case "children":
                    case "dangerouslySetInnerHTML":
                      throw Error(formatProdErrorMessage(137, tag));
                    default:
                      setProp(domElement, tag, propKey, propValue, props, null);
                  }
              }
            hasSrcSet && setProp(domElement, tag, "srcSet", props.srcSet, props, null);
            hasSrc && setProp(domElement, tag, "src", props.src, props, null);
            return;
          case "input":
            listenToNonDelegatedEvent("invalid", domElement);
            var defaultValue = propKey = propValue = hasSrcSet = null, checked = null, defaultChecked = null;
            for (hasSrc in props)
              if (props.hasOwnProperty(hasSrc)) {
                var propValue$186 = props[hasSrc];
                if (null != propValue$186)
                  switch (hasSrc) {
                    case "name":
                      hasSrcSet = propValue$186;
                      break;
                    case "type":
                      propValue = propValue$186;
                      break;
                    case "checked":
                      checked = propValue$186;
                      break;
                    case "defaultChecked":
                      defaultChecked = propValue$186;
                      break;
                    case "value":
                      propKey = propValue$186;
                      break;
                    case "defaultValue":
                      defaultValue = propValue$186;
                      break;
                    case "children":
                    case "dangerouslySetInnerHTML":
                      if (null != propValue$186)
                        throw Error(formatProdErrorMessage(137, tag));
                      break;
                    default:
                      setProp(domElement, tag, hasSrc, propValue$186, props, null);
                  }
              }
            initInput(
              domElement,
              propKey,
              defaultValue,
              checked,
              defaultChecked,
              propValue,
              hasSrcSet,
              false
            );
            track(domElement);
            return;
          case "select":
            listenToNonDelegatedEvent("invalid", domElement);
            hasSrc = propValue = propKey = null;
            for (hasSrcSet in props)
              if (props.hasOwnProperty(hasSrcSet) && (defaultValue = props[hasSrcSet], null != defaultValue))
                switch (hasSrcSet) {
                  case "value":
                    propKey = defaultValue;
                    break;
                  case "defaultValue":
                    propValue = defaultValue;
                    break;
                  case "multiple":
                    hasSrc = defaultValue;
                  default:
                    setProp(domElement, tag, hasSrcSet, defaultValue, props, null);
                }
            tag = propKey;
            props = propValue;
            domElement.multiple = !!hasSrc;
            null != tag ? updateOptions(domElement, !!hasSrc, tag, false) : null != props && updateOptions(domElement, !!hasSrc, props, true);
            return;
          case "textarea":
            listenToNonDelegatedEvent("invalid", domElement);
            propKey = hasSrcSet = hasSrc = null;
            for (propValue in props)
              if (props.hasOwnProperty(propValue) && (defaultValue = props[propValue], null != defaultValue))
                switch (propValue) {
                  case "value":
                    hasSrc = defaultValue;
                    break;
                  case "defaultValue":
                    hasSrcSet = defaultValue;
                    break;
                  case "children":
                    propKey = defaultValue;
                    break;
                  case "dangerouslySetInnerHTML":
                    if (null != defaultValue) throw Error(formatProdErrorMessage(91));
                    break;
                  default:
                    setProp(domElement, tag, propValue, defaultValue, props, null);
                }
            initTextarea(domElement, hasSrc, hasSrcSet, propKey);
            track(domElement);
            return;
          case "option":
            for (checked in props)
              if (props.hasOwnProperty(checked) && (hasSrc = props[checked], null != hasSrc))
                switch (checked) {
                  case "selected":
                    domElement.selected = hasSrc && "function" !== typeof hasSrc && "symbol" !== typeof hasSrc;
                    break;
                  default:
                    setProp(domElement, tag, checked, hasSrc, props, null);
                }
            return;
          case "dialog":
            listenToNonDelegatedEvent("cancel", domElement);
            listenToNonDelegatedEvent("close", domElement);
            break;
          case "iframe":
          case "object":
            listenToNonDelegatedEvent("load", domElement);
            break;
          case "video":
          case "audio":
            for (hasSrc = 0; hasSrc < mediaEventTypes.length; hasSrc++)
              listenToNonDelegatedEvent(mediaEventTypes[hasSrc], domElement);
            break;
          case "image":
            listenToNonDelegatedEvent("error", domElement);
            listenToNonDelegatedEvent("load", domElement);
            break;
          case "details":
            listenToNonDelegatedEvent("toggle", domElement);
            break;
          case "embed":
          case "source":
          case "link":
            listenToNonDelegatedEvent("error", domElement), listenToNonDelegatedEvent("load", domElement);
          case "area":
          case "base":
          case "br":
          case "col":
          case "hr":
          case "keygen":
          case "meta":
          case "param":
          case "track":
          case "wbr":
          case "menuitem":
            for (defaultChecked in props)
              if (props.hasOwnProperty(defaultChecked) && (hasSrc = props[defaultChecked], null != hasSrc))
                switch (defaultChecked) {
                  case "children":
                  case "dangerouslySetInnerHTML":
                    throw Error(formatProdErrorMessage(137, tag));
                  default:
                    setProp(domElement, tag, defaultChecked, hasSrc, props, null);
                }
            return;
          default:
            if (isCustomElement(tag)) {
              for (propValue$186 in props)
                props.hasOwnProperty(propValue$186) && (hasSrc = props[propValue$186], void 0 !== hasSrc && setPropOnCustomElement(
                  domElement,
                  tag,
                  propValue$186,
                  hasSrc,
                  props,
                  void 0
                ));
              return;
            }
        }
        for (defaultValue in props)
          props.hasOwnProperty(defaultValue) && (hasSrc = props[defaultValue], null != hasSrc && setProp(domElement, tag, defaultValue, hasSrc, props, null));
      }
      function updateProperties(domElement, tag, lastProps, nextProps) {
        switch (tag) {
          case "div":
          case "span":
          case "svg":
          case "path":
          case "a":
          case "g":
          case "p":
          case "li":
            break;
          case "input":
            var name = null, type2 = null, value = null, defaultValue = null, lastDefaultValue = null, checked = null, defaultChecked = null;
            for (propKey in lastProps) {
              var lastProp = lastProps[propKey];
              if (lastProps.hasOwnProperty(propKey) && null != lastProp)
                switch (propKey) {
                  case "checked":
                    break;
                  case "value":
                    break;
                  case "defaultValue":
                    lastDefaultValue = lastProp;
                  default:
                    nextProps.hasOwnProperty(propKey) || setProp(domElement, tag, propKey, null, nextProps, lastProp);
                }
            }
            for (var propKey$203 in nextProps) {
              var propKey = nextProps[propKey$203];
              lastProp = lastProps[propKey$203];
              if (nextProps.hasOwnProperty(propKey$203) && (null != propKey || null != lastProp))
                switch (propKey$203) {
                  case "type":
                    type2 = propKey;
                    break;
                  case "name":
                    name = propKey;
                    break;
                  case "checked":
                    checked = propKey;
                    break;
                  case "defaultChecked":
                    defaultChecked = propKey;
                    break;
                  case "value":
                    value = propKey;
                    break;
                  case "defaultValue":
                    defaultValue = propKey;
                    break;
                  case "children":
                  case "dangerouslySetInnerHTML":
                    if (null != propKey)
                      throw Error(formatProdErrorMessage(137, tag));
                    break;
                  default:
                    propKey !== lastProp && setProp(
                      domElement,
                      tag,
                      propKey$203,
                      propKey,
                      nextProps,
                      lastProp
                    );
                }
            }
            updateInput(
              domElement,
              value,
              defaultValue,
              lastDefaultValue,
              checked,
              defaultChecked,
              type2,
              name
            );
            return;
          case "select":
            propKey = value = defaultValue = propKey$203 = null;
            for (type2 in lastProps)
              if (lastDefaultValue = lastProps[type2], lastProps.hasOwnProperty(type2) && null != lastDefaultValue)
                switch (type2) {
                  case "value":
                    break;
                  case "multiple":
                    propKey = lastDefaultValue;
                  default:
                    nextProps.hasOwnProperty(type2) || setProp(
                      domElement,
                      tag,
                      type2,
                      null,
                      nextProps,
                      lastDefaultValue
                    );
                }
            for (name in nextProps)
              if (type2 = nextProps[name], lastDefaultValue = lastProps[name], nextProps.hasOwnProperty(name) && (null != type2 || null != lastDefaultValue))
                switch (name) {
                  case "value":
                    propKey$203 = type2;
                    break;
                  case "defaultValue":
                    defaultValue = type2;
                    break;
                  case "multiple":
                    value = type2;
                  default:
                    type2 !== lastDefaultValue && setProp(
                      domElement,
                      tag,
                      name,
                      type2,
                      nextProps,
                      lastDefaultValue
                    );
                }
            tag = defaultValue;
            lastProps = value;
            nextProps = propKey;
            null != propKey$203 ? updateOptions(domElement, !!lastProps, propKey$203, false) : !!nextProps !== !!lastProps && (null != tag ? updateOptions(domElement, !!lastProps, tag, true) : updateOptions(domElement, !!lastProps, lastProps ? [] : "", false));
            return;
          case "textarea":
            propKey = propKey$203 = null;
            for (defaultValue in lastProps)
              if (name = lastProps[defaultValue], lastProps.hasOwnProperty(defaultValue) && null != name && !nextProps.hasOwnProperty(defaultValue))
                switch (defaultValue) {
                  case "value":
                    break;
                  case "children":
                    break;
                  default:
                    setProp(domElement, tag, defaultValue, null, nextProps, name);
                }
            for (value in nextProps)
              if (name = nextProps[value], type2 = lastProps[value], nextProps.hasOwnProperty(value) && (null != name || null != type2))
                switch (value) {
                  case "value":
                    propKey$203 = name;
                    break;
                  case "defaultValue":
                    propKey = name;
                    break;
                  case "children":
                    break;
                  case "dangerouslySetInnerHTML":
                    if (null != name) throw Error(formatProdErrorMessage(91));
                    break;
                  default:
                    name !== type2 && setProp(domElement, tag, value, name, nextProps, type2);
                }
            updateTextarea(domElement, propKey$203, propKey);
            return;
          case "option":
            for (var propKey$219 in lastProps)
              if (propKey$203 = lastProps[propKey$219], lastProps.hasOwnProperty(propKey$219) && null != propKey$203 && !nextProps.hasOwnProperty(propKey$219))
                switch (propKey$219) {
                  case "selected":
                    domElement.selected = false;
                    break;
                  default:
                    setProp(
                      domElement,
                      tag,
                      propKey$219,
                      null,
                      nextProps,
                      propKey$203
                    );
                }
            for (lastDefaultValue in nextProps)
              if (propKey$203 = nextProps[lastDefaultValue], propKey = lastProps[lastDefaultValue], nextProps.hasOwnProperty(lastDefaultValue) && propKey$203 !== propKey && (null != propKey$203 || null != propKey))
                switch (lastDefaultValue) {
                  case "selected":
                    domElement.selected = propKey$203 && "function" !== typeof propKey$203 && "symbol" !== typeof propKey$203;
                    break;
                  default:
                    setProp(
                      domElement,
                      tag,
                      lastDefaultValue,
                      propKey$203,
                      nextProps,
                      propKey
                    );
                }
            return;
          case "img":
          case "link":
          case "area":
          case "base":
          case "br":
          case "col":
          case "embed":
          case "hr":
          case "keygen":
          case "meta":
          case "param":
          case "source":
          case "track":
          case "wbr":
          case "menuitem":
            for (var propKey$224 in lastProps)
              propKey$203 = lastProps[propKey$224], lastProps.hasOwnProperty(propKey$224) && null != propKey$203 && !nextProps.hasOwnProperty(propKey$224) && setProp(domElement, tag, propKey$224, null, nextProps, propKey$203);
            for (checked in nextProps)
              if (propKey$203 = nextProps[checked], propKey = lastProps[checked], nextProps.hasOwnProperty(checked) && propKey$203 !== propKey && (null != propKey$203 || null != propKey))
                switch (checked) {
                  case "children":
                  case "dangerouslySetInnerHTML":
                    if (null != propKey$203)
                      throw Error(formatProdErrorMessage(137, tag));
                    break;
                  default:
                    setProp(
                      domElement,
                      tag,
                      checked,
                      propKey$203,
                      nextProps,
                      propKey
                    );
                }
            return;
          default:
            if (isCustomElement(tag)) {
              for (var propKey$229 in lastProps)
                propKey$203 = lastProps[propKey$229], lastProps.hasOwnProperty(propKey$229) && void 0 !== propKey$203 && !nextProps.hasOwnProperty(propKey$229) && setPropOnCustomElement(
                  domElement,
                  tag,
                  propKey$229,
                  void 0,
                  nextProps,
                  propKey$203
                );
              for (defaultChecked in nextProps)
                propKey$203 = nextProps[defaultChecked], propKey = lastProps[defaultChecked], !nextProps.hasOwnProperty(defaultChecked) || propKey$203 === propKey || void 0 === propKey$203 && void 0 === propKey || setPropOnCustomElement(
                  domElement,
                  tag,
                  defaultChecked,
                  propKey$203,
                  nextProps,
                  propKey
                );
              return;
            }
        }
        for (var propKey$234 in lastProps)
          propKey$203 = lastProps[propKey$234], lastProps.hasOwnProperty(propKey$234) && null != propKey$203 && !nextProps.hasOwnProperty(propKey$234) && setProp(domElement, tag, propKey$234, null, nextProps, propKey$203);
        for (lastProp in nextProps)
          propKey$203 = nextProps[lastProp], propKey = lastProps[lastProp], !nextProps.hasOwnProperty(lastProp) || propKey$203 === propKey || null == propKey$203 && null == propKey || setProp(domElement, tag, lastProp, propKey$203, nextProps, propKey);
      }
      var eventsEnabled = null;
      var selectionInformation = null;
      function getOwnerDocumentFromRootContainer(rootContainerElement) {
        return 9 === rootContainerElement.nodeType ? rootContainerElement : rootContainerElement.ownerDocument;
      }
      function getOwnHostContext(namespaceURI) {
        switch (namespaceURI) {
          case "http://www.w3.org/2000/svg":
            return 1;
          case "http://www.w3.org/1998/Math/MathML":
            return 2;
          default:
            return 0;
        }
      }
      function getChildHostContextProd(parentNamespace, type2) {
        if (0 === parentNamespace)
          switch (type2) {
            case "svg":
              return 1;
            case "math":
              return 2;
            default:
              return 0;
          }
        return 1 === parentNamespace && "foreignObject" === type2 ? 0 : parentNamespace;
      }
      function shouldSetTextContent(type2, props) {
        return "textarea" === type2 || "noscript" === type2 || "string" === typeof props.children || "number" === typeof props.children || "bigint" === typeof props.children || "object" === typeof props.dangerouslySetInnerHTML && null !== props.dangerouslySetInnerHTML && null != props.dangerouslySetInnerHTML.__html;
      }
      var currentPopstateTransitionEvent = null;
      function shouldAttemptEagerTransition() {
        var event = window.event;
        if (event && "popstate" === event.type) {
          if (event === currentPopstateTransitionEvent) return false;
          currentPopstateTransitionEvent = event;
          return true;
        }
        currentPopstateTransitionEvent = null;
        return false;
      }
      var scheduleTimeout = "function" === typeof setTimeout ? setTimeout : void 0;
      var cancelTimeout = "function" === typeof clearTimeout ? clearTimeout : void 0;
      var localPromise = "function" === typeof Promise ? Promise : void 0;
      var scheduleMicrotask = "function" === typeof queueMicrotask ? queueMicrotask : "undefined" !== typeof localPromise ? function(callback) {
        return localPromise.resolve(null).then(callback).catch(handleErrorInNextTick);
      } : scheduleTimeout;
      function handleErrorInNextTick(error) {
        setTimeout(function() {
          throw error;
        });
      }
      function clearSuspenseBoundary(parentInstance, suspenseInstance) {
        var node = suspenseInstance, depth2 = 0;
        do {
          var nextNode = node.nextSibling;
          parentInstance.removeChild(node);
          if (nextNode && 8 === nextNode.nodeType)
            if (node = nextNode.data, "/$" === node) {
              if (0 === depth2) {
                parentInstance.removeChild(nextNode);
                retryIfBlockedOn(suspenseInstance);
                return;
              }
              depth2--;
            } else "$" !== node && "$?" !== node && "$!" !== node || depth2++;
          node = nextNode;
        } while (node);
        retryIfBlockedOn(suspenseInstance);
      }
      function clearContainerSparingly(container) {
        var nextNode = container.firstChild;
        nextNode && 10 === nextNode.nodeType && (nextNode = nextNode.nextSibling);
        for (; nextNode; ) {
          var node = nextNode;
          nextNode = nextNode.nextSibling;
          switch (node.nodeName) {
            case "HTML":
            case "HEAD":
            case "BODY":
              clearContainerSparingly(node);
              detachDeletedInstance(node);
              continue;
            case "SCRIPT":
            case "STYLE":
              continue;
            case "LINK":
              if ("stylesheet" === node.rel.toLowerCase()) continue;
          }
          container.removeChild(node);
        }
      }
      function canHydrateInstance(instance, type2, props, inRootOrSingleton) {
        for (; 1 === instance.nodeType; ) {
          var anyProps = props;
          if (instance.nodeName.toLowerCase() !== type2.toLowerCase()) {
            if (!inRootOrSingleton && ("INPUT" !== instance.nodeName || "hidden" !== instance.type))
              break;
          } else if (!inRootOrSingleton)
            if ("input" === type2 && "hidden" === instance.type) {
              var name = null == anyProps.name ? null : "" + anyProps.name;
              if ("hidden" === anyProps.type && instance.getAttribute("name") === name)
                return instance;
            } else return instance;
          else if (!instance[internalHoistableMarker])
            switch (type2) {
              case "meta":
                if (!instance.hasAttribute("itemprop")) break;
                return instance;
              case "link":
                name = instance.getAttribute("rel");
                if ("stylesheet" === name && instance.hasAttribute("data-precedence"))
                  break;
                else if (name !== anyProps.rel || instance.getAttribute("href") !== (null == anyProps.href ? null : anyProps.href) || instance.getAttribute("crossorigin") !== (null == anyProps.crossOrigin ? null : anyProps.crossOrigin) || instance.getAttribute("title") !== (null == anyProps.title ? null : anyProps.title))
                  break;
                return instance;
              case "style":
                if (instance.hasAttribute("data-precedence")) break;
                return instance;
              case "script":
                name = instance.getAttribute("src");
                if ((name !== (null == anyProps.src ? null : anyProps.src) || instance.getAttribute("type") !== (null == anyProps.type ? null : anyProps.type) || instance.getAttribute("crossorigin") !== (null == anyProps.crossOrigin ? null : anyProps.crossOrigin)) && name && instance.hasAttribute("async") && !instance.hasAttribute("itemprop"))
                  break;
                return instance;
              default:
                return instance;
            }
          instance = getNextHydratable(instance.nextSibling);
          if (null === instance) break;
        }
        return null;
      }
      function canHydrateTextInstance(instance, text, inRootOrSingleton) {
        if ("" === text) return null;
        for (; 3 !== instance.nodeType; ) {
          if ((1 !== instance.nodeType || "INPUT" !== instance.nodeName || "hidden" !== instance.type) && !inRootOrSingleton)
            return null;
          instance = getNextHydratable(instance.nextSibling);
          if (null === instance) return null;
        }
        return instance;
      }
      function getNextHydratable(node) {
        for (; null != node; node = node.nextSibling) {
          var nodeType = node.nodeType;
          if (1 === nodeType || 3 === nodeType) break;
          if (8 === nodeType) {
            nodeType = node.data;
            if ("$" === nodeType || "$!" === nodeType || "$?" === nodeType || "F!" === nodeType || "F" === nodeType)
              break;
            if ("/$" === nodeType) return null;
          }
        }
        return node;
      }
      function getParentSuspenseInstance(targetInstance) {
        targetInstance = targetInstance.previousSibling;
        for (var depth2 = 0; targetInstance; ) {
          if (8 === targetInstance.nodeType) {
            var data = targetInstance.data;
            if ("$" === data || "$!" === data || "$?" === data) {
              if (0 === depth2) return targetInstance;
              depth2--;
            } else "/$" === data && depth2++;
          }
          targetInstance = targetInstance.previousSibling;
        }
        return null;
      }
      function resolveSingletonInstance(type2, props, rootContainerInstance) {
        props = getOwnerDocumentFromRootContainer(rootContainerInstance);
        switch (type2) {
          case "html":
            type2 = props.documentElement;
            if (!type2) throw Error(formatProdErrorMessage(452));
            return type2;
          case "head":
            type2 = props.head;
            if (!type2) throw Error(formatProdErrorMessage(453));
            return type2;
          case "body":
            type2 = props.body;
            if (!type2) throw Error(formatProdErrorMessage(454));
            return type2;
          default:
            throw Error(formatProdErrorMessage(451));
        }
      }
      var preloadPropsMap = /* @__PURE__ */ new Map();
      var preconnectsSet = /* @__PURE__ */ new Set();
      function getHoistableRoot(container) {
        return "function" === typeof container.getRootNode ? container.getRootNode() : container.ownerDocument;
      }
      var previousDispatcher = ReactDOMSharedInternals.d;
      ReactDOMSharedInternals.d = {
        f: flushSyncWork,
        r: requestFormReset,
        D: prefetchDNS,
        C: preconnect,
        L: preload,
        m: preloadModule,
        X: preinitScript,
        S: preinitStyle,
        M: preinitModuleScript
      };
      function flushSyncWork() {
        var previousWasRendering = previousDispatcher.f(), wasRendering = flushSyncWork$1();
        return previousWasRendering || wasRendering;
      }
      function requestFormReset(form) {
        var formInst = getInstanceFromNode(form);
        null !== formInst && 5 === formInst.tag && "form" === formInst.type ? requestFormReset$1(formInst) : previousDispatcher.r(form);
      }
      var globalDocument = "undefined" === typeof document ? null : document;
      function preconnectAs(rel, href, crossOrigin) {
        var ownerDocument = globalDocument;
        if (ownerDocument && "string" === typeof href && href) {
          var limitedEscapedHref = escapeSelectorAttributeValueInsideDoubleQuotes(href);
          limitedEscapedHref = 'link[rel="' + rel + '"][href="' + limitedEscapedHref + '"]';
          "string" === typeof crossOrigin && (limitedEscapedHref += '[crossorigin="' + crossOrigin + '"]');
          preconnectsSet.has(limitedEscapedHref) || (preconnectsSet.add(limitedEscapedHref), rel = { rel, crossOrigin, href }, null === ownerDocument.querySelector(limitedEscapedHref) && (href = ownerDocument.createElement("link"), setInitialProperties(href, "link", rel), markNodeAsHoistable(href), ownerDocument.head.appendChild(href)));
        }
      }
      function prefetchDNS(href) {
        previousDispatcher.D(href);
        preconnectAs("dns-prefetch", href, null);
      }
      function preconnect(href, crossOrigin) {
        previousDispatcher.C(href, crossOrigin);
        preconnectAs("preconnect", href, crossOrigin);
      }
      function preload(href, as, options2) {
        previousDispatcher.L(href, as, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && href && as) {
          var preloadSelector = 'link[rel="preload"][as="' + escapeSelectorAttributeValueInsideDoubleQuotes(as) + '"]';
          "image" === as ? options2 && options2.imageSrcSet ? (preloadSelector += '[imagesrcset="' + escapeSelectorAttributeValueInsideDoubleQuotes(
            options2.imageSrcSet
          ) + '"]', "string" === typeof options2.imageSizes && (preloadSelector += '[imagesizes="' + escapeSelectorAttributeValueInsideDoubleQuotes(
            options2.imageSizes
          ) + '"]')) : preloadSelector += '[href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]' : preloadSelector += '[href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]';
          var key = preloadSelector;
          switch (as) {
            case "style":
              key = getStyleKey(href);
              break;
            case "script":
              key = getScriptKey(href);
          }
          preloadPropsMap.has(key) || (href = assign(
            {
              rel: "preload",
              href: "image" === as && options2 && options2.imageSrcSet ? void 0 : href,
              as
            },
            options2
          ), preloadPropsMap.set(key, href), null !== ownerDocument.querySelector(preloadSelector) || "style" === as && ownerDocument.querySelector(getStylesheetSelectorFromKey(key)) || "script" === as && ownerDocument.querySelector(getScriptSelectorFromKey(key)) || (as = ownerDocument.createElement("link"), setInitialProperties(as, "link", href), markNodeAsHoistable(as), ownerDocument.head.appendChild(as)));
        }
      }
      function preloadModule(href, options2) {
        previousDispatcher.m(href, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && href) {
          var as = options2 && "string" === typeof options2.as ? options2.as : "script", preloadSelector = 'link[rel="modulepreload"][as="' + escapeSelectorAttributeValueInsideDoubleQuotes(as) + '"][href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]', key = preloadSelector;
          switch (as) {
            case "audioworklet":
            case "paintworklet":
            case "serviceworker":
            case "sharedworker":
            case "worker":
            case "script":
              key = getScriptKey(href);
          }
          if (!preloadPropsMap.has(key) && (href = assign({ rel: "modulepreload", href }, options2), preloadPropsMap.set(key, href), null === ownerDocument.querySelector(preloadSelector))) {
            switch (as) {
              case "audioworklet":
              case "paintworklet":
              case "serviceworker":
              case "sharedworker":
              case "worker":
              case "script":
                if (ownerDocument.querySelector(getScriptSelectorFromKey(key)))
                  return;
            }
            as = ownerDocument.createElement("link");
            setInitialProperties(as, "link", href);
            markNodeAsHoistable(as);
            ownerDocument.head.appendChild(as);
          }
        }
      }
      function preinitStyle(href, precedence, options2) {
        previousDispatcher.S(href, precedence, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && href) {
          var styles = getResourcesFromRoot(ownerDocument).hoistableStyles, key = getStyleKey(href);
          precedence = precedence || "default";
          var resource = styles.get(key);
          if (!resource) {
            var state = { loading: 0, preload: null };
            if (resource = ownerDocument.querySelector(
              getStylesheetSelectorFromKey(key)
            ))
              state.loading = 5;
            else {
              href = assign(
                { rel: "stylesheet", href, "data-precedence": precedence },
                options2
              );
              (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForStylesheet(href, options2);
              var link = resource = ownerDocument.createElement("link");
              markNodeAsHoistable(link);
              setInitialProperties(link, "link", href);
              link._p = new Promise(function(resolve, reject2) {
                link.onload = resolve;
                link.onerror = reject2;
              });
              link.addEventListener("load", function() {
                state.loading |= 1;
              });
              link.addEventListener("error", function() {
                state.loading |= 2;
              });
              state.loading |= 4;
              insertStylesheet(resource, precedence, ownerDocument);
            }
            resource = {
              type: "stylesheet",
              instance: resource,
              count: 1,
              state
            };
            styles.set(key, resource);
          }
        }
      }
      function preinitScript(src, options2) {
        previousDispatcher.X(src, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && src) {
          var scripts = getResourcesFromRoot(ownerDocument).hoistableScripts, key = getScriptKey(src), resource = scripts.get(key);
          resource || (resource = ownerDocument.querySelector(getScriptSelectorFromKey(key)), resource || (src = assign({ src, async: true }, options2), (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForScript(src, options2), resource = ownerDocument.createElement("script"), markNodeAsHoistable(resource), setInitialProperties(resource, "link", src), ownerDocument.head.appendChild(resource)), resource = {
            type: "script",
            instance: resource,
            count: 1,
            state: null
          }, scripts.set(key, resource));
        }
      }
      function preinitModuleScript(src, options2) {
        previousDispatcher.M(src, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && src) {
          var scripts = getResourcesFromRoot(ownerDocument).hoistableScripts, key = getScriptKey(src), resource = scripts.get(key);
          resource || (resource = ownerDocument.querySelector(getScriptSelectorFromKey(key)), resource || (src = assign({ src, async: true, type: "module" }, options2), (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForScript(src, options2), resource = ownerDocument.createElement("script"), markNodeAsHoistable(resource), setInitialProperties(resource, "link", src), ownerDocument.head.appendChild(resource)), resource = {
            type: "script",
            instance: resource,
            count: 1,
            state: null
          }, scripts.set(key, resource));
        }
      }
      function getResource(type2, currentProps, pendingProps, currentResource) {
        var JSCompiler_inline_result = (JSCompiler_inline_result = rootInstanceStackCursor.current) ? getHoistableRoot(JSCompiler_inline_result) : null;
        if (!JSCompiler_inline_result) throw Error(formatProdErrorMessage(446));
        switch (type2) {
          case "meta":
          case "title":
            return null;
          case "style":
            return "string" === typeof pendingProps.precedence && "string" === typeof pendingProps.href ? (currentProps = getStyleKey(pendingProps.href), pendingProps = getResourcesFromRoot(
              JSCompiler_inline_result
            ).hoistableStyles, currentResource = pendingProps.get(currentProps), currentResource || (currentResource = {
              type: "style",
              instance: null,
              count: 0,
              state: null
            }, pendingProps.set(currentProps, currentResource)), currentResource) : { type: "void", instance: null, count: 0, state: null };
          case "link":
            if ("stylesheet" === pendingProps.rel && "string" === typeof pendingProps.href && "string" === typeof pendingProps.precedence) {
              type2 = getStyleKey(pendingProps.href);
              var styles$242 = getResourcesFromRoot(
                JSCompiler_inline_result
              ).hoistableStyles, resource$243 = styles$242.get(type2);
              resource$243 || (JSCompiler_inline_result = JSCompiler_inline_result.ownerDocument || JSCompiler_inline_result, resource$243 = {
                type: "stylesheet",
                instance: null,
                count: 0,
                state: { loading: 0, preload: null }
              }, styles$242.set(type2, resource$243), (styles$242 = JSCompiler_inline_result.querySelector(
                getStylesheetSelectorFromKey(type2)
              )) && !styles$242._p && (resource$243.instance = styles$242, resource$243.state.loading = 5), preloadPropsMap.has(type2) || (pendingProps = {
                rel: "preload",
                as: "style",
                href: pendingProps.href,
                crossOrigin: pendingProps.crossOrigin,
                integrity: pendingProps.integrity,
                media: pendingProps.media,
                hrefLang: pendingProps.hrefLang,
                referrerPolicy: pendingProps.referrerPolicy
              }, preloadPropsMap.set(type2, pendingProps), styles$242 || preloadStylesheet(
                JSCompiler_inline_result,
                type2,
                pendingProps,
                resource$243.state
              )));
              if (currentProps && null === currentResource)
                throw Error(formatProdErrorMessage(528, ""));
              return resource$243;
            }
            if (currentProps && null !== currentResource)
              throw Error(formatProdErrorMessage(529, ""));
            return null;
          case "script":
            return currentProps = pendingProps.async, pendingProps = pendingProps.src, "string" === typeof pendingProps && currentProps && "function" !== typeof currentProps && "symbol" !== typeof currentProps ? (currentProps = getScriptKey(pendingProps), pendingProps = getResourcesFromRoot(
              JSCompiler_inline_result
            ).hoistableScripts, currentResource = pendingProps.get(currentProps), currentResource || (currentResource = {
              type: "script",
              instance: null,
              count: 0,
              state: null
            }, pendingProps.set(currentProps, currentResource)), currentResource) : { type: "void", instance: null, count: 0, state: null };
          default:
            throw Error(formatProdErrorMessage(444, type2));
        }
      }
      function getStyleKey(href) {
        return 'href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"';
      }
      function getStylesheetSelectorFromKey(key) {
        return 'link[rel="stylesheet"][' + key + "]";
      }
      function stylesheetPropsFromRawProps(rawProps) {
        return assign({}, rawProps, {
          "data-precedence": rawProps.precedence,
          precedence: null
        });
      }
      function preloadStylesheet(ownerDocument, key, preloadProps, state) {
        ownerDocument.querySelector('link[rel="preload"][as="style"][' + key + "]") ? state.loading = 1 : (key = ownerDocument.createElement("link"), state.preload = key, key.addEventListener("load", function() {
          return state.loading |= 1;
        }), key.addEventListener("error", function() {
          return state.loading |= 2;
        }), setInitialProperties(key, "link", preloadProps), markNodeAsHoistable(key), ownerDocument.head.appendChild(key));
      }
      function getScriptKey(src) {
        return '[src="' + escapeSelectorAttributeValueInsideDoubleQuotes(src) + '"]';
      }
      function getScriptSelectorFromKey(key) {
        return "script[async]" + key;
      }
      function acquireResource(hoistableRoot, resource, props) {
        resource.count++;
        if (null === resource.instance)
          switch (resource.type) {
            case "style":
              var instance = hoistableRoot.querySelector(
                'style[data-href~="' + escapeSelectorAttributeValueInsideDoubleQuotes(props.href) + '"]'
              );
              if (instance)
                return resource.instance = instance, markNodeAsHoistable(instance), instance;
              var styleProps = assign({}, props, {
                "data-href": props.href,
                "data-precedence": props.precedence,
                href: null,
                precedence: null
              });
              instance = (hoistableRoot.ownerDocument || hoistableRoot).createElement(
                "style"
              );
              markNodeAsHoistable(instance);
              setInitialProperties(instance, "style", styleProps);
              insertStylesheet(instance, props.precedence, hoistableRoot);
              return resource.instance = instance;
            case "stylesheet":
              styleProps = getStyleKey(props.href);
              var instance$248 = hoistableRoot.querySelector(
                getStylesheetSelectorFromKey(styleProps)
              );
              if (instance$248)
                return resource.state.loading |= 4, resource.instance = instance$248, markNodeAsHoistable(instance$248), instance$248;
              instance = stylesheetPropsFromRawProps(props);
              (styleProps = preloadPropsMap.get(styleProps)) && adoptPreloadPropsForStylesheet(instance, styleProps);
              instance$248 = (hoistableRoot.ownerDocument || hoistableRoot).createElement("link");
              markNodeAsHoistable(instance$248);
              var linkInstance = instance$248;
              linkInstance._p = new Promise(function(resolve, reject2) {
                linkInstance.onload = resolve;
                linkInstance.onerror = reject2;
              });
              setInitialProperties(instance$248, "link", instance);
              resource.state.loading |= 4;
              insertStylesheet(instance$248, props.precedence, hoistableRoot);
              return resource.instance = instance$248;
            case "script":
              instance$248 = getScriptKey(props.src);
              if (styleProps = hoistableRoot.querySelector(
                getScriptSelectorFromKey(instance$248)
              ))
                return resource.instance = styleProps, markNodeAsHoistable(styleProps), styleProps;
              instance = props;
              if (styleProps = preloadPropsMap.get(instance$248))
                instance = assign({}, props), adoptPreloadPropsForScript(instance, styleProps);
              hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
              styleProps = hoistableRoot.createElement("script");
              markNodeAsHoistable(styleProps);
              setInitialProperties(styleProps, "link", instance);
              hoistableRoot.head.appendChild(styleProps);
              return resource.instance = styleProps;
            case "void":
              return null;
            default:
              throw Error(formatProdErrorMessage(443, resource.type));
          }
        else
          "stylesheet" === resource.type && 0 === (resource.state.loading & 4) && (instance = resource.instance, resource.state.loading |= 4, insertStylesheet(instance, props.precedence, hoistableRoot));
        return resource.instance;
      }
      function insertStylesheet(instance, precedence, root2) {
        for (var nodes = root2.querySelectorAll(
          'link[rel="stylesheet"][data-precedence],style[data-precedence]'
        ), last = nodes.length ? nodes[nodes.length - 1] : null, prior = last, i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          if (node.dataset.precedence === precedence) prior = node;
          else if (prior !== last) break;
        }
        prior ? prior.parentNode.insertBefore(instance, prior.nextSibling) : (precedence = 9 === root2.nodeType ? root2.head : root2, precedence.insertBefore(instance, precedence.firstChild));
      }
      function adoptPreloadPropsForStylesheet(stylesheetProps, preloadProps) {
        null == stylesheetProps.crossOrigin && (stylesheetProps.crossOrigin = preloadProps.crossOrigin);
        null == stylesheetProps.referrerPolicy && (stylesheetProps.referrerPolicy = preloadProps.referrerPolicy);
        null == stylesheetProps.title && (stylesheetProps.title = preloadProps.title);
      }
      function adoptPreloadPropsForScript(scriptProps, preloadProps) {
        null == scriptProps.crossOrigin && (scriptProps.crossOrigin = preloadProps.crossOrigin);
        null == scriptProps.referrerPolicy && (scriptProps.referrerPolicy = preloadProps.referrerPolicy);
        null == scriptProps.integrity && (scriptProps.integrity = preloadProps.integrity);
      }
      var tagCaches = null;
      function getHydratableHoistableCache(type2, keyAttribute, ownerDocument) {
        if (null === tagCaches) {
          var cache = /* @__PURE__ */ new Map();
          var caches = tagCaches = /* @__PURE__ */ new Map();
          caches.set(ownerDocument, cache);
        } else
          caches = tagCaches, cache = caches.get(ownerDocument), cache || (cache = /* @__PURE__ */ new Map(), caches.set(ownerDocument, cache));
        if (cache.has(type2)) return cache;
        cache.set(type2, null);
        ownerDocument = ownerDocument.getElementsByTagName(type2);
        for (caches = 0; caches < ownerDocument.length; caches++) {
          var node = ownerDocument[caches];
          if (!(node[internalHoistableMarker] || node[internalInstanceKey] || "link" === type2 && "stylesheet" === node.getAttribute("rel")) && "http://www.w3.org/2000/svg" !== node.namespaceURI) {
            var nodeKey = node.getAttribute(keyAttribute) || "";
            nodeKey = type2 + nodeKey;
            var existing = cache.get(nodeKey);
            existing ? existing.push(node) : cache.set(nodeKey, [node]);
          }
        }
        return cache;
      }
      function mountHoistable(hoistableRoot, type2, instance) {
        hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
        hoistableRoot.head.insertBefore(
          instance,
          "title" === type2 ? hoistableRoot.querySelector("head > title") : null
        );
      }
      function isHostHoistableType(type2, props, hostContext) {
        if (1 === hostContext || null != props.itemProp) return false;
        switch (type2) {
          case "meta":
          case "title":
            return true;
          case "style":
            if ("string" !== typeof props.precedence || "string" !== typeof props.href || "" === props.href)
              break;
            return true;
          case "link":
            if ("string" !== typeof props.rel || "string" !== typeof props.href || "" === props.href || props.onLoad || props.onError)
              break;
            switch (props.rel) {
              case "stylesheet":
                return type2 = props.disabled, "string" === typeof props.precedence && null == type2;
              default:
                return true;
            }
          case "script":
            if (props.async && "function" !== typeof props.async && "symbol" !== typeof props.async && !props.onLoad && !props.onError && props.src && "string" === typeof props.src)
              return true;
        }
        return false;
      }
      function preloadResource(resource) {
        return "stylesheet" === resource.type && 0 === (resource.state.loading & 3) ? false : true;
      }
      var suspendedState = null;
      function noop() {
      }
      function suspendResource(hoistableRoot, resource, props) {
        if (null === suspendedState) throw Error(formatProdErrorMessage(475));
        var state = suspendedState;
        if ("stylesheet" === resource.type && ("string" !== typeof props.media || false !== matchMedia(props.media).matches) && 0 === (resource.state.loading & 4)) {
          if (null === resource.instance) {
            var key = getStyleKey(props.href), instance = hoistableRoot.querySelector(
              getStylesheetSelectorFromKey(key)
            );
            if (instance) {
              hoistableRoot = instance._p;
              null !== hoistableRoot && "object" === typeof hoistableRoot && "function" === typeof hoistableRoot.then && (state.count++, state = onUnsuspend.bind(state), hoistableRoot.then(state, state));
              resource.state.loading |= 4;
              resource.instance = instance;
              markNodeAsHoistable(instance);
              return;
            }
            instance = hoistableRoot.ownerDocument || hoistableRoot;
            props = stylesheetPropsFromRawProps(props);
            (key = preloadPropsMap.get(key)) && adoptPreloadPropsForStylesheet(props, key);
            instance = instance.createElement("link");
            markNodeAsHoistable(instance);
            var linkInstance = instance;
            linkInstance._p = new Promise(function(resolve, reject2) {
              linkInstance.onload = resolve;
              linkInstance.onerror = reject2;
            });
            setInitialProperties(instance, "link", props);
            resource.instance = instance;
          }
          null === state.stylesheets && (state.stylesheets = /* @__PURE__ */ new Map());
          state.stylesheets.set(resource, hoistableRoot);
          (hoistableRoot = resource.state.preload) && 0 === (resource.state.loading & 3) && (state.count++, resource = onUnsuspend.bind(state), hoistableRoot.addEventListener("load", resource), hoistableRoot.addEventListener("error", resource));
        }
      }
      function waitForCommitToBeReady() {
        if (null === suspendedState) throw Error(formatProdErrorMessage(475));
        var state = suspendedState;
        state.stylesheets && 0 === state.count && insertSuspendedStylesheets(state, state.stylesheets);
        return 0 < state.count ? function(commit) {
          var stylesheetTimer = setTimeout(function() {
            state.stylesheets && insertSuspendedStylesheets(state, state.stylesheets);
            if (state.unsuspend) {
              var unsuspend = state.unsuspend;
              state.unsuspend = null;
              unsuspend();
            }
          }, 6e4);
          state.unsuspend = commit;
          return function() {
            state.unsuspend = null;
            clearTimeout(stylesheetTimer);
          };
        } : null;
      }
      function onUnsuspend() {
        this.count--;
        if (0 === this.count) {
          if (this.stylesheets) insertSuspendedStylesheets(this, this.stylesheets);
          else if (this.unsuspend) {
            var unsuspend = this.unsuspend;
            this.unsuspend = null;
            unsuspend();
          }
        }
      }
      var precedencesByRoot = null;
      function insertSuspendedStylesheets(state, resources) {
        state.stylesheets = null;
        null !== state.unsuspend && (state.count++, precedencesByRoot = /* @__PURE__ */ new Map(), resources.forEach(insertStylesheetIntoRoot, state), precedencesByRoot = null, onUnsuspend.call(state));
      }
      function insertStylesheetIntoRoot(root2, resource) {
        if (!(resource.state.loading & 4)) {
          var precedences = precedencesByRoot.get(root2);
          if (precedences) var last = precedences.get(null);
          else {
            precedences = /* @__PURE__ */ new Map();
            precedencesByRoot.set(root2, precedences);
            for (var nodes = root2.querySelectorAll(
              "link[data-precedence],style[data-precedence]"
            ), i = 0; i < nodes.length; i++) {
              var node = nodes[i];
              if ("LINK" === node.nodeName || "not all" !== node.getAttribute("media"))
                precedences.set(node.dataset.precedence, node), last = node;
            }
            last && precedences.set(null, last);
          }
          nodes = resource.instance;
          node = nodes.getAttribute("data-precedence");
          i = precedences.get(node) || last;
          i === last && precedences.set(null, nodes);
          precedences.set(node, nodes);
          this.count++;
          last = onUnsuspend.bind(this);
          nodes.addEventListener("load", last);
          nodes.addEventListener("error", last);
          i ? i.parentNode.insertBefore(nodes, i.nextSibling) : (root2 = 9 === root2.nodeType ? root2.head : root2, root2.insertBefore(nodes, root2.firstChild));
          resource.state.loading |= 4;
        }
      }
      var HostTransitionContext = {
        $$typeof: REACT_CONTEXT_TYPE,
        Provider: null,
        Consumer: null,
        _currentValue: sharedNotPendingObject,
        _currentValue2: sharedNotPendingObject,
        _threadCount: 0
      };
      function FiberRootNode(containerInfo, tag, hydrate, identifierPrefix, onUncaughtError, onCaughtError, onRecoverableError, formState) {
        this.tag = 1;
        this.containerInfo = containerInfo;
        this.finishedWork = this.pingCache = this.current = this.pendingChildren = null;
        this.timeoutHandle = -1;
        this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null;
        this.callbackPriority = 0;
        this.expirationTimes = createLaneMap(-1);
        this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.finishedLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
        this.entanglements = createLaneMap(0);
        this.hiddenUpdates = createLaneMap(null);
        this.identifierPrefix = identifierPrefix;
        this.onUncaughtError = onUncaughtError;
        this.onCaughtError = onCaughtError;
        this.onRecoverableError = onRecoverableError;
        this.pooledCache = null;
        this.pooledCacheLanes = 0;
        this.formState = formState;
        this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function createFiberRoot(containerInfo, tag, hydrate, initialChildren, hydrationCallbacks, isStrictMode, identifierPrefix, onUncaughtError, onCaughtError, onRecoverableError, transitionCallbacks, formState) {
        containerInfo = new FiberRootNode(
          containerInfo,
          tag,
          hydrate,
          identifierPrefix,
          onUncaughtError,
          onCaughtError,
          onRecoverableError,
          formState
        );
        tag = 1;
        true === isStrictMode && (tag |= 24);
        isStrictMode = createFiberImplClass(3, null, null, tag);
        containerInfo.current = isStrictMode;
        isStrictMode.stateNode = containerInfo;
        tag = createCache();
        tag.refCount++;
        containerInfo.pooledCache = tag;
        tag.refCount++;
        isStrictMode.memoizedState = {
          element: initialChildren,
          isDehydrated: hydrate,
          cache: tag
        };
        initializeUpdateQueue(isStrictMode);
        return containerInfo;
      }
      function getContextForSubtree(parentComponent) {
        if (!parentComponent) return emptyContextObject;
        parentComponent = emptyContextObject;
        return parentComponent;
      }
      function updateContainerImpl(rootFiber, lane, element, container, parentComponent, callback) {
        parentComponent = getContextForSubtree(parentComponent);
        null === container.context ? container.context = parentComponent : container.pendingContext = parentComponent;
        container = createUpdate(lane);
        container.payload = { element };
        callback = void 0 === callback ? null : callback;
        null !== callback && (container.callback = callback);
        element = enqueueUpdate(rootFiber, container, lane);
        null !== element && (scheduleUpdateOnFiber(element, rootFiber, lane), entangleTransitions(element, rootFiber, lane));
      }
      function markRetryLaneImpl(fiber, retryLane) {
        fiber = fiber.memoizedState;
        if (null !== fiber && null !== fiber.dehydrated) {
          var a = fiber.retryLane;
          fiber.retryLane = 0 !== a && a < retryLane ? a : retryLane;
        }
      }
      function markRetryLaneIfNotHydrated(fiber, retryLane) {
        markRetryLaneImpl(fiber, retryLane);
        (fiber = fiber.alternate) && markRetryLaneImpl(fiber, retryLane);
      }
      function attemptContinuousHydration(fiber) {
        if (13 === fiber.tag) {
          var root2 = enqueueConcurrentRenderForLane(fiber, 67108864);
          null !== root2 && scheduleUpdateOnFiber(root2, fiber, 67108864);
          markRetryLaneIfNotHydrated(fiber, 67108864);
        }
      }
      var _enabled = true;
      function dispatchDiscreteEvent(domEventName, eventSystemFlags, container, nativeEvent) {
        var prevTransition = ReactSharedInternals.T;
        ReactSharedInternals.T = null;
        var previousPriority = ReactDOMSharedInternals.p;
        try {
          ReactDOMSharedInternals.p = 2, dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
        } finally {
          ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
        }
      }
      function dispatchContinuousEvent(domEventName, eventSystemFlags, container, nativeEvent) {
        var prevTransition = ReactSharedInternals.T;
        ReactSharedInternals.T = null;
        var previousPriority = ReactDOMSharedInternals.p;
        try {
          ReactDOMSharedInternals.p = 8, dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
        } finally {
          ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
        }
      }
      function dispatchEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent) {
        if (_enabled) {
          var blockedOn = findInstanceBlockingEvent(nativeEvent);
          if (null === blockedOn)
            dispatchEventForPluginEventSystem(
              domEventName,
              eventSystemFlags,
              nativeEvent,
              return_targetInst,
              targetContainer
            ), clearIfContinuousEvent(domEventName, nativeEvent);
          else if (queueIfContinuousEvent(
            blockedOn,
            domEventName,
            eventSystemFlags,
            targetContainer,
            nativeEvent
          ))
            nativeEvent.stopPropagation();
          else if (clearIfContinuousEvent(domEventName, nativeEvent), eventSystemFlags & 4 && -1 < discreteReplayableEvents.indexOf(domEventName)) {
            for (; null !== blockedOn; ) {
              var fiber = getInstanceFromNode(blockedOn);
              if (null !== fiber)
                switch (fiber.tag) {
                  case 3:
                    fiber = fiber.stateNode;
                    if (fiber.current.memoizedState.isDehydrated) {
                      var lanes = getHighestPriorityLanes(fiber.pendingLanes);
                      if (0 !== lanes) {
                        var root2 = fiber;
                        root2.pendingLanes |= 2;
                        for (root2.entangledLanes |= 2; lanes; ) {
                          var lane = 1 << 31 - clz32(lanes);
                          root2.entanglements[1] |= lane;
                          lanes &= ~lane;
                        }
                        ensureRootIsScheduled(fiber);
                        0 === (executionContext & 6) && (workInProgressRootRenderTargetTime = now() + 500, flushSyncWorkAcrossRoots_impl(0, false));
                      }
                    }
                    break;
                  case 13:
                    root2 = enqueueConcurrentRenderForLane(fiber, 2), null !== root2 && scheduleUpdateOnFiber(root2, fiber, 2), flushSyncWork$1(), markRetryLaneIfNotHydrated(fiber, 2);
                }
              fiber = findInstanceBlockingEvent(nativeEvent);
              null === fiber && dispatchEventForPluginEventSystem(
                domEventName,
                eventSystemFlags,
                nativeEvent,
                return_targetInst,
                targetContainer
              );
              if (fiber === blockedOn) break;
              blockedOn = fiber;
            }
            null !== blockedOn && nativeEvent.stopPropagation();
          } else
            dispatchEventForPluginEventSystem(
              domEventName,
              eventSystemFlags,
              nativeEvent,
              null,
              targetContainer
            );
        }
      }
      function findInstanceBlockingEvent(nativeEvent) {
        nativeEvent = getEventTarget(nativeEvent);
        return findInstanceBlockingTarget(nativeEvent);
      }
      var return_targetInst = null;
      function findInstanceBlockingTarget(targetNode) {
        return_targetInst = null;
        targetNode = getClosestInstanceFromNode(targetNode);
        if (null !== targetNode) {
          var nearestMounted = getNearestMountedFiber(targetNode);
          if (null === nearestMounted) targetNode = null;
          else {
            var tag = nearestMounted.tag;
            if (13 === tag) {
              targetNode = getSuspenseInstanceFromFiber(nearestMounted);
              if (null !== targetNode) return targetNode;
              targetNode = null;
            } else if (3 === tag) {
              if (nearestMounted.stateNode.current.memoizedState.isDehydrated)
                return 3 === nearestMounted.tag ? nearestMounted.stateNode.containerInfo : null;
              targetNode = null;
            } else nearestMounted !== targetNode && (targetNode = null);
          }
        }
        return_targetInst = targetNode;
        return null;
      }
      function getEventPriority(domEventName) {
        switch (domEventName) {
          case "beforetoggle":
          case "cancel":
          case "click":
          case "close":
          case "contextmenu":
          case "copy":
          case "cut":
          case "auxclick":
          case "dblclick":
          case "dragend":
          case "dragstart":
          case "drop":
          case "focusin":
          case "focusout":
          case "input":
          case "invalid":
          case "keydown":
          case "keypress":
          case "keyup":
          case "mousedown":
          case "mouseup":
          case "paste":
          case "pause":
          case "play":
          case "pointercancel":
          case "pointerdown":
          case "pointerup":
          case "ratechange":
          case "reset":
          case "resize":
          case "seeked":
          case "submit":
          case "toggle":
          case "touchcancel":
          case "touchend":
          case "touchstart":
          case "volumechange":
          case "change":
          case "selectionchange":
          case "textInput":
          case "compositionstart":
          case "compositionend":
          case "compositionupdate":
          case "beforeblur":
          case "afterblur":
          case "beforeinput":
          case "blur":
          case "fullscreenchange":
          case "focus":
          case "hashchange":
          case "popstate":
          case "select":
          case "selectstart":
            return 2;
          case "drag":
          case "dragenter":
          case "dragexit":
          case "dragleave":
          case "dragover":
          case "mousemove":
          case "mouseout":
          case "mouseover":
          case "pointermove":
          case "pointerout":
          case "pointerover":
          case "scroll":
          case "touchmove":
          case "wheel":
          case "mouseenter":
          case "mouseleave":
          case "pointerenter":
          case "pointerleave":
            return 8;
          case "message":
            switch (getCurrentPriorityLevel()) {
              case ImmediatePriority:
                return 2;
              case UserBlockingPriority:
                return 8;
              case NormalPriority$1:
              case LowPriority:
                return 32;
              case IdlePriority:
                return 268435456;
              default:
                return 32;
            }
          default:
            return 32;
        }
      }
      var hasScheduledReplayAttempt = false;
      var queuedFocus = null;
      var queuedDrag = null;
      var queuedMouse = null;
      var queuedPointers = /* @__PURE__ */ new Map();
      var queuedPointerCaptures = /* @__PURE__ */ new Map();
      var queuedExplicitHydrationTargets = [];
      var discreteReplayableEvents = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
        " "
      );
      function clearIfContinuousEvent(domEventName, nativeEvent) {
        switch (domEventName) {
          case "focusin":
          case "focusout":
            queuedFocus = null;
            break;
          case "dragenter":
          case "dragleave":
            queuedDrag = null;
            break;
          case "mouseover":
          case "mouseout":
            queuedMouse = null;
            break;
          case "pointerover":
          case "pointerout":
            queuedPointers.delete(nativeEvent.pointerId);
            break;
          case "gotpointercapture":
          case "lostpointercapture":
            queuedPointerCaptures.delete(nativeEvent.pointerId);
        }
      }
      function accumulateOrCreateContinuousQueuedReplayableEvent(existingQueuedEvent, blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
        if (null === existingQueuedEvent || existingQueuedEvent.nativeEvent !== nativeEvent)
          return existingQueuedEvent = {
            blockedOn,
            domEventName,
            eventSystemFlags,
            nativeEvent,
            targetContainers: [targetContainer]
          }, null !== blockedOn && (blockedOn = getInstanceFromNode(blockedOn), null !== blockedOn && attemptContinuousHydration(blockedOn)), existingQueuedEvent;
        existingQueuedEvent.eventSystemFlags |= eventSystemFlags;
        blockedOn = existingQueuedEvent.targetContainers;
        null !== targetContainer && -1 === blockedOn.indexOf(targetContainer) && blockedOn.push(targetContainer);
        return existingQueuedEvent;
      }
      function queueIfContinuousEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
        switch (domEventName) {
          case "focusin":
            return queuedFocus = accumulateOrCreateContinuousQueuedReplayableEvent(
              queuedFocus,
              blockedOn,
              domEventName,
              eventSystemFlags,
              targetContainer,
              nativeEvent
            ), true;
          case "dragenter":
            return queuedDrag = accumulateOrCreateContinuousQueuedReplayableEvent(
              queuedDrag,
              blockedOn,
              domEventName,
              eventSystemFlags,
              targetContainer,
              nativeEvent
            ), true;
          case "mouseover":
            return queuedMouse = accumulateOrCreateContinuousQueuedReplayableEvent(
              queuedMouse,
              blockedOn,
              domEventName,
              eventSystemFlags,
              targetContainer,
              nativeEvent
            ), true;
          case "pointerover":
            var pointerId = nativeEvent.pointerId;
            queuedPointers.set(
              pointerId,
              accumulateOrCreateContinuousQueuedReplayableEvent(
                queuedPointers.get(pointerId) || null,
                blockedOn,
                domEventName,
                eventSystemFlags,
                targetContainer,
                nativeEvent
              )
            );
            return true;
          case "gotpointercapture":
            return pointerId = nativeEvent.pointerId, queuedPointerCaptures.set(
              pointerId,
              accumulateOrCreateContinuousQueuedReplayableEvent(
                queuedPointerCaptures.get(pointerId) || null,
                blockedOn,
                domEventName,
                eventSystemFlags,
                targetContainer,
                nativeEvent
              )
            ), true;
        }
        return false;
      }
      function attemptExplicitHydrationTarget(queuedTarget) {
        var targetInst = getClosestInstanceFromNode(queuedTarget.target);
        if (null !== targetInst) {
          var nearestMounted = getNearestMountedFiber(targetInst);
          if (null !== nearestMounted) {
            if (targetInst = nearestMounted.tag, 13 === targetInst) {
              if (targetInst = getSuspenseInstanceFromFiber(nearestMounted), null !== targetInst) {
                queuedTarget.blockedOn = targetInst;
                runWithPriority(queuedTarget.priority, function() {
                  if (13 === nearestMounted.tag) {
                    var lane = requestUpdateLane(), root2 = enqueueConcurrentRenderForLane(nearestMounted, lane);
                    null !== root2 && scheduleUpdateOnFiber(root2, nearestMounted, lane);
                    markRetryLaneIfNotHydrated(nearestMounted, lane);
                  }
                });
                return;
              }
            } else if (3 === targetInst && nearestMounted.stateNode.current.memoizedState.isDehydrated) {
              queuedTarget.blockedOn = 3 === nearestMounted.tag ? nearestMounted.stateNode.containerInfo : null;
              return;
            }
          }
        }
        queuedTarget.blockedOn = null;
      }
      function attemptReplayContinuousQueuedEvent(queuedEvent) {
        if (null !== queuedEvent.blockedOn) return false;
        for (var targetContainers = queuedEvent.targetContainers; 0 < targetContainers.length; ) {
          var nextBlockedOn = findInstanceBlockingEvent(queuedEvent.nativeEvent);
          if (null === nextBlockedOn) {
            nextBlockedOn = queuedEvent.nativeEvent;
            var nativeEventClone = new nextBlockedOn.constructor(
              nextBlockedOn.type,
              nextBlockedOn
            );
            currentReplayingEvent = nativeEventClone;
            nextBlockedOn.target.dispatchEvent(nativeEventClone);
            currentReplayingEvent = null;
          } else
            return targetContainers = getInstanceFromNode(nextBlockedOn), null !== targetContainers && attemptContinuousHydration(targetContainers), queuedEvent.blockedOn = nextBlockedOn, false;
          targetContainers.shift();
        }
        return true;
      }
      function attemptReplayContinuousQueuedEventInMap(queuedEvent, key, map) {
        attemptReplayContinuousQueuedEvent(queuedEvent) && map.delete(key);
      }
      function replayUnblockedEvents() {
        hasScheduledReplayAttempt = false;
        null !== queuedFocus && attemptReplayContinuousQueuedEvent(queuedFocus) && (queuedFocus = null);
        null !== queuedDrag && attemptReplayContinuousQueuedEvent(queuedDrag) && (queuedDrag = null);
        null !== queuedMouse && attemptReplayContinuousQueuedEvent(queuedMouse) && (queuedMouse = null);
        queuedPointers.forEach(attemptReplayContinuousQueuedEventInMap);
        queuedPointerCaptures.forEach(attemptReplayContinuousQueuedEventInMap);
      }
      function scheduleCallbackIfUnblocked(queuedEvent, unblocked) {
        queuedEvent.blockedOn === unblocked && (queuedEvent.blockedOn = null, hasScheduledReplayAttempt || (hasScheduledReplayAttempt = true, Scheduler.unstable_scheduleCallback(
          Scheduler.unstable_NormalPriority,
          replayUnblockedEvents
        )));
      }
      var lastScheduledReplayQueue = null;
      function scheduleReplayQueueIfNeeded(formReplayingQueue) {
        lastScheduledReplayQueue !== formReplayingQueue && (lastScheduledReplayQueue = formReplayingQueue, Scheduler.unstable_scheduleCallback(
          Scheduler.unstable_NormalPriority,
          function() {
            lastScheduledReplayQueue === formReplayingQueue && (lastScheduledReplayQueue = null);
            for (var i = 0; i < formReplayingQueue.length; i += 3) {
              var form = formReplayingQueue[i], submitterOrAction = formReplayingQueue[i + 1], formData = formReplayingQueue[i + 2];
              if ("function" !== typeof submitterOrAction)
                if (null === findInstanceBlockingTarget(submitterOrAction || form))
                  continue;
                else break;
              var formInst = getInstanceFromNode(form);
              null !== formInst && (formReplayingQueue.splice(i, 3), i -= 3, startHostTransition(
                formInst,
                {
                  pending: true,
                  data: formData,
                  method: form.method,
                  action: submitterOrAction
                },
                submitterOrAction,
                formData
              ));
            }
          }
        ));
      }
      function retryIfBlockedOn(unblocked) {
        function unblock(queuedEvent) {
          return scheduleCallbackIfUnblocked(queuedEvent, unblocked);
        }
        null !== queuedFocus && scheduleCallbackIfUnblocked(queuedFocus, unblocked);
        null !== queuedDrag && scheduleCallbackIfUnblocked(queuedDrag, unblocked);
        null !== queuedMouse && scheduleCallbackIfUnblocked(queuedMouse, unblocked);
        queuedPointers.forEach(unblock);
        queuedPointerCaptures.forEach(unblock);
        for (var i = 0; i < queuedExplicitHydrationTargets.length; i++) {
          var queuedTarget = queuedExplicitHydrationTargets[i];
          queuedTarget.blockedOn === unblocked && (queuedTarget.blockedOn = null);
        }
        for (; 0 < queuedExplicitHydrationTargets.length && (i = queuedExplicitHydrationTargets[0], null === i.blockedOn); )
          attemptExplicitHydrationTarget(i), null === i.blockedOn && queuedExplicitHydrationTargets.shift();
        i = (unblocked.ownerDocument || unblocked).$$reactFormReplay;
        if (null != i)
          for (queuedTarget = 0; queuedTarget < i.length; queuedTarget += 3) {
            var form = i[queuedTarget], submitterOrAction = i[queuedTarget + 1], formProps = form[internalPropsKey] || null;
            if ("function" === typeof submitterOrAction)
              formProps || scheduleReplayQueueIfNeeded(i);
            else if (formProps) {
              var action = null;
              if (submitterOrAction && submitterOrAction.hasAttribute("formAction"))
                if (form = submitterOrAction, formProps = submitterOrAction[internalPropsKey] || null)
                  action = formProps.formAction;
                else {
                  if (null !== findInstanceBlockingTarget(form)) continue;
                }
              else action = formProps.action;
              "function" === typeof action ? i[queuedTarget + 1] = action : (i.splice(queuedTarget, 3), queuedTarget -= 3);
              scheduleReplayQueueIfNeeded(i);
            }
          }
      }
      function ReactDOMRoot(internalRoot) {
        this._internalRoot = internalRoot;
      }
      ReactDOMHydrationRoot.prototype.render = ReactDOMRoot.prototype.render = function(children) {
        var root2 = this._internalRoot;
        if (null === root2) throw Error(formatProdErrorMessage(409));
        var current = root2.current, lane = requestUpdateLane();
        updateContainerImpl(current, lane, children, root2, null, null);
      };
      ReactDOMHydrationRoot.prototype.unmount = ReactDOMRoot.prototype.unmount = function() {
        var root2 = this._internalRoot;
        if (null !== root2) {
          this._internalRoot = null;
          var container = root2.containerInfo;
          0 === root2.tag && flushPassiveEffects();
          updateContainerImpl(root2.current, 2, null, root2, null, null);
          flushSyncWork$1();
          container[internalContainerInstanceKey] = null;
        }
      };
      function ReactDOMHydrationRoot(internalRoot) {
        this._internalRoot = internalRoot;
      }
      ReactDOMHydrationRoot.prototype.unstable_scheduleHydration = function(target) {
        if (target) {
          var updatePriority = resolveUpdatePriority();
          target = { blockedOn: null, target, priority: updatePriority };
          for (var i = 0; i < queuedExplicitHydrationTargets.length && 0 !== updatePriority && updatePriority < queuedExplicitHydrationTargets[i].priority; i++) ;
          queuedExplicitHydrationTargets.splice(i, 0, target);
          0 === i && attemptExplicitHydrationTarget(target);
        }
      };
      var isomorphicReactPackageVersion$jscomp$inline_1686 = React.version;
      if ("19.0.0" !== isomorphicReactPackageVersion$jscomp$inline_1686)
        throw Error(
          formatProdErrorMessage(
            527,
            isomorphicReactPackageVersion$jscomp$inline_1686,
            "19.0.0"
          )
        );
      ReactDOMSharedInternals.findDOMNode = function(componentOrElement) {
        var fiber = componentOrElement._reactInternals;
        if (void 0 === fiber) {
          if ("function" === typeof componentOrElement.render)
            throw Error(formatProdErrorMessage(188));
          componentOrElement = Object.keys(componentOrElement).join(",");
          throw Error(formatProdErrorMessage(268, componentOrElement));
        }
        componentOrElement = findCurrentFiberUsingSlowPath(fiber);
        componentOrElement = null !== componentOrElement ? findCurrentHostFiberImpl(componentOrElement) : null;
        componentOrElement = null === componentOrElement ? null : componentOrElement.stateNode;
        return componentOrElement;
      };
      var internals$jscomp$inline_2165 = {
        bundleType: 0,
        version: "19.0.0",
        rendererPackageName: "react-dom",
        currentDispatcherRef: ReactSharedInternals,
        findFiberByHostInstance: getClosestInstanceFromNode,
        reconcilerVersion: "19.0.0"
      };
      if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
        hook$jscomp$inline_2166 = __REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (!hook$jscomp$inline_2166.isDisabled && hook$jscomp$inline_2166.supportsFiber)
          try {
            rendererID = hook$jscomp$inline_2166.inject(
              internals$jscomp$inline_2165
            ), injectedHook = hook$jscomp$inline_2166;
          } catch (err) {
          }
      }
      var hook$jscomp$inline_2166;
      exports.createRoot = function(container, options2) {
        if (!isValidContainer(container)) throw Error(formatProdErrorMessage(299));
        var isStrictMode = false, identifierPrefix = "", onUncaughtError = defaultOnUncaughtError, onCaughtError = defaultOnCaughtError, onRecoverableError = defaultOnRecoverableError, transitionCallbacks = null;
        null !== options2 && void 0 !== options2 && (true === options2.unstable_strictMode && (isStrictMode = true), void 0 !== options2.identifierPrefix && (identifierPrefix = options2.identifierPrefix), void 0 !== options2.onUncaughtError && (onUncaughtError = options2.onUncaughtError), void 0 !== options2.onCaughtError && (onCaughtError = options2.onCaughtError), void 0 !== options2.onRecoverableError && (onRecoverableError = options2.onRecoverableError), void 0 !== options2.unstable_transitionCallbacks && (transitionCallbacks = options2.unstable_transitionCallbacks));
        options2 = createFiberRoot(
          container,
          1,
          false,
          null,
          null,
          isStrictMode,
          identifierPrefix,
          onUncaughtError,
          onCaughtError,
          onRecoverableError,
          transitionCallbacks,
          null
        );
        container[internalContainerInstanceKey] = options2.current;
        listenToAllSupportedEvents(
          8 === container.nodeType ? container.parentNode : container
        );
        return new ReactDOMRoot(options2);
      };
      exports.hydrateRoot = function(container, initialChildren, options2) {
        if (!isValidContainer(container)) throw Error(formatProdErrorMessage(299));
        var isStrictMode = false, identifierPrefix = "", onUncaughtError = defaultOnUncaughtError, onCaughtError = defaultOnCaughtError, onRecoverableError = defaultOnRecoverableError, transitionCallbacks = null, formState = null;
        null !== options2 && void 0 !== options2 && (true === options2.unstable_strictMode && (isStrictMode = true), void 0 !== options2.identifierPrefix && (identifierPrefix = options2.identifierPrefix), void 0 !== options2.onUncaughtError && (onUncaughtError = options2.onUncaughtError), void 0 !== options2.onCaughtError && (onCaughtError = options2.onCaughtError), void 0 !== options2.onRecoverableError && (onRecoverableError = options2.onRecoverableError), void 0 !== options2.unstable_transitionCallbacks && (transitionCallbacks = options2.unstable_transitionCallbacks), void 0 !== options2.formState && (formState = options2.formState));
        initialChildren = createFiberRoot(
          container,
          1,
          true,
          initialChildren,
          null != options2 ? options2 : null,
          isStrictMode,
          identifierPrefix,
          onUncaughtError,
          onCaughtError,
          onRecoverableError,
          transitionCallbacks,
          formState
        );
        initialChildren.context = getContextForSubtree(null);
        options2 = initialChildren.current;
        isStrictMode = requestUpdateLane();
        identifierPrefix = createUpdate(isStrictMode);
        identifierPrefix.callback = null;
        enqueueUpdate(options2, identifierPrefix, isStrictMode);
        initialChildren.current.lanes = isStrictMode;
        markRootUpdated$1(initialChildren, isStrictMode);
        ensureRootIsScheduled(initialChildren);
        container[internalContainerInstanceKey] = initialChildren.current;
        listenToAllSupportedEvents(container);
        return new ReactDOMHydrationRoot(initialChildren);
      };
      exports.version = "19.0.0";
    }
  });

  // ../../../ad-motion-verify/node_modules/react-dom/client.js
  var require_client = __commonJS({
    "../../../ad-motion-verify/node_modules/react-dom/client.js"(exports, module) {
      "use strict";
      function checkDCE() {
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
          return;
        }
        if (false) {
          throw new Error("^_^");
        }
        try {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
        } catch (err) {
          console.error(err);
        }
      }
      if (true) {
        checkDCE();
        module.exports = require_react_dom_client_production();
      } else {
        module.exports = null;
      }
    }
  });

  // ../../../ad-motion-verify/node_modules/react/cjs/react-jsx-runtime.production.js
  var require_react_jsx_runtime_production = __commonJS({
    "../../../ad-motion-verify/node_modules/react/cjs/react-jsx-runtime.production.js"(exports) {
      "use strict";
      var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
      var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
      function jsxProd(type2, config, maybeKey) {
        var key = null;
        void 0 !== maybeKey && (key = "" + maybeKey);
        void 0 !== config.key && (key = "" + config.key);
        if ("key" in config) {
          maybeKey = {};
          for (var propName in config)
            "key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        config = maybeKey.ref;
        return {
          $$typeof: REACT_ELEMENT_TYPE,
          type: type2,
          key,
          ref: void 0 !== config ? config : null,
          props: maybeKey
        };
      }
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.jsx = jsxProd;
      exports.jsxs = jsxProd;
    }
  });

  // ../../../ad-motion-verify/node_modules/react/jsx-runtime.js
  var require_jsx_runtime = __commonJS({
    "../../../ad-motion-verify/node_modules/react/jsx-runtime.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_react_jsx_runtime_production();
      } else {
        module.exports = null;
      }
    }
  });

  // pixel-job27/firebase.ts
  var firebase_exports = {};
  __export(firebase_exports, {
    db: () => db,
    functions: () => functions
  });
  var functions, db;
  var init_firebase = __esm({
    "pixel-job27/firebase.ts"() {
      functions = {};
      db = {};
    }
  });

  // pixel-job27/entry.tsx
  var import_client = __toESM(require_client());

  // ../../../ad-admin-spacing26/apps/admin/src/experience/StaffShell.tsx
  var import_react = __toESM(require_react());

  // pixel-spacing26/push.tsx
  var PushAlertsButton = () => null;

  // pixel-spacing26/link.tsx
  var import_jsx_runtime = __toESM(require_jsx_runtime());
  function Link({ href, children, ...p2 }) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: typeof href === "string" ? href : "#", ...p2, onClick: (e) => {
      e.preventDefault();
      document.body.dataset.open = href;
    }, children });
  }

  // ../../packages/ui/src/theme/glyphs.ts
  var DUOTONE = {
    "bay": '<defs><mask id="mbay" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path fill="#000" d="M25,19 H39 L40,26 H24 Z"/><path fill="#000" d="M25,38 H39 L38.2,44 H25.8 Z"/></mask></defs><g mask="url(#mbay)"><path fill="none" stroke="#2E2E33" stroke-linecap="round" d="M11,8 V56 M53,8 V56" stroke-width="4.2"/><path fill="#2E2E33" d="M22,14 Q22,10 26,10 H38 Q42,10 42,14 V47 Q42,51 38,51 H26 Q22,51 22,47 Z"/></g><path fill="#EC8638" d="M8,54 H56 L55,58 H7 Z"/><path fill="#EC8638" d="M24,13 H28 V16 H24Z M36,13 H40 V16 H36Z"/>',
    "bookings": '<defs><mask id="mbookings" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" d="M20.5,41 L28,48.5 L43.5,32" stroke-width="5"/></mask></defs><g mask="url(#mbookings)"><path fill="#2E2E33" d="M9,16 Q9,12 13,12 H51 Q55,12 55,16 V52 Q55,56 51,56 H13 Q9,56 9,52 Z"/><path fill="none" stroke="#2E2E33" stroke-linecap="round" d="M21,7 V17 M43,7 V17" stroke-width="4.2"/></g><path fill="#EC8638" d="M9,16 Q9,12 13,12 H51 Q55,12 55,16 V25 H9 Z"/>',
    "break": '<defs><mask id="mbreak" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/></mask></defs><g mask="url(#mbreak)"><path fill="#2E2E33" d="M10,26 H44 V40 Q44,52 32,52 H22 Q10,52 10,40 Z"/><path fill="none" stroke="#2E2E33" stroke-linecap="round" d="M44,30 H49 Q55,30 55,36 Q55,42 49,42 H44" stroke-width="4"/></g><path fill="#EC8638" d="M8,56 H48 L47,59.6 H7 Z"/><path fill="none" stroke="#EC8638" stroke-linecap="round" d="M20,9 Q25,14 20,19 M31,7 Q36,13 31,20" stroke-width="3.4"/>',
    "ceramic": '<defs><mask id="mceramic" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/></mask></defs><g mask="url(#mceramic)"><path fill="#2E2E33" d="M32,5 L55,13 V32 Q55,49 32,59 Q9,49 9,32 V13 Z"/></g><path fill="#EC8638" transform="translate(32,31) scale(1.7)" d="M0,-10 L2.6,-2.6 L10,0 L2.6,2.6 L0,10 L-2.6,2.6 L-10,0 L-2.6,-2.6 Z"/><path fill="#EC8638" transform="translate(50,52) scale(0.55)" d="M0,-10 L2.6,-2.6 L10,0 L2.6,2.6 L0,10 L-2.6,2.6 L-10,0 L-2.6,-2.6 Z"/><path fill="#EC8638" transform="translate(13,57) scale(0.0)" d="M0,-10 L2.6,-2.6 L10,0 L2.6,2.6 L0,10 L-2.6,2.6 L-10,0 L-2.6,-2.6 Z"/>',
    "check-in": '<defs><mask id="mcheck-in" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" d="M22,37 L29,44 L43,28" stroke-width="5"/></mask></defs><g mask="url(#mcheck-in)"><path fill="#2E2E33" d="M14,12 H50 Q52,12 52,14 V54 Q52,56 50,56 H14 Q12,56 12,54 V14 Q12,12 14,12 Z"/></g><path fill="#EC8638" d="M23,6 H41 V15 H23 Z"/>',
    "check-out": '<defs><mask id="mcheck-out" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" d="M20,36 H42 M34,28 L42,36 L34,44" stroke-width="5"/></mask></defs><g mask="url(#mcheck-out)"><path fill="#2E2E33" d="M14,12 H50 Q52,12 52,14 V54 Q52,56 50,56 H14 Q12,56 12,54 V14 Q12,12 14,12 Z"/></g><path fill="#EC8638" d="M23,6 H41 V15 H23 Z"/>',
    "detailing": '<defs><mask id="mdetailing" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path fill="#000" d="M24,36 H38 V50 H24 Z"/></mask></defs><g mask="url(#mdetailing)"><path fill="#2E2E33" d="M20,27 H38 Q42,27 42,31 V54 Q42,58 38,58 H24 Q20,58 20,54 Z"/><path fill="#2E2E33" d="M26,17 H34 V27 H26 Z"/></g><path fill="#EC8638" d="M20,8 H38 L45,11.5 V17 H20 Z"/><path fill="#EC8638" d="M24,43 H37 L36,46.6 H23 Z"/><circle fill="#EC8638" cx="51" cy="11" r="2.2"/><circle fill="#EC8638" cx="55" cy="18" r="2.6"/><circle fill="#EC8638" cx="50" cy="25" r="2"/><path fill="#EC8638" transform="translate(12,16) scale(0.6)" d="M0,-10 L2.6,-2.6 L10,0 L2.6,2.6 L0,10 L-2.6,2.6 L-10,0 L-2.6,-2.6 Z"/>',
    "garage": '<defs><mask id="mgarage" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path fill="#000" d="M13,56 V34 H51 V56 Z"/></mask></defs><g mask="url(#mgarage)"><path fill="#2E2E33" d="M4,31 L32,8 L60,31 V55 Q60,56 59,56 H5 Q4,56 4,55 Z"/></g><path fill="#EC8638" d="M16,38 H49 L48,41.6 H15 Z"/><path fill="#EC8638" d="M15,44.4 H48 L47,48 H14 Z"/><path fill="#EC8638" d="M14,50.8 H47 L46,54.4 H13 Z"/>',
    "home": '<defs><mask id="mhome" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/></mask></defs><g mask="url(#mhome)"><path fill="#2E2E33" d="M4,32 L32,8 L60,32 L55,37.5 L50,33.2 V54.5 Q50,56 48.5,56 H15.5 Q14,56 14,54.5 V33.2 L9,37.5 Z"/></g><path fill="#EC8638" d="M25.5,56 L28.3,40 H35.7 L38.5,56 Z"/>',
    "invoice": '<defs><mask id="minvoice" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path fill="#000" d="M38,6 V20 H52 Z"/><path fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" d="M20,30 H44 M20,38 H44" stroke-width="3.6"/></mask></defs><g mask="url(#minvoice)"><path fill="#2E2E33" d="M14,6 H38 L52,20 V56 Q52,58 50,58 H14 Q12,58 12,56 V8 Q12,6 14,6 Z"/></g><path fill="#EC8638" d="M20,46 H36 L34.8,50 H18.8 Z"/>',
    "membership": '<defs><mask id="mmembership" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><circle fill="#000" cx="32" cy="36" r="4"/></mask></defs><g mask="url(#mmembership)"><path fill="#2E2E33" d="M7,44 L11,18 L23,30 L32,12 L41,30 L53,18 L57,44 Z"/></g><path fill="#EC8638" d="M9,48 H55 L54,54 H8 Z"/><circle fill="#EC8638" cx="11" cy="15" r="3.2"/><circle fill="#EC8638" cx="53" cy="15" r="3.2"/><circle fill="#EC8638" cx="32" cy="9" r="3.2"/>',
    "notifications": '<defs><mask id="mnotifications" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/></mask></defs><g mask="url(#mnotifications)"><path fill="#2E2E33" d="M32,7 Q45,7 45,22 V32 L51,42 V46 H13 V42 L19,32 V22 Q19,7 32,7 Z"/></g><path fill="#EC8638" d="M25,50 H39 Q39,58 32,58 Q25,58 25,50Z"/><circle fill="#EC8638" cx="47" cy="13" r="7"/>',
    "payments": '<defs><mask id="mpayments" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path fill="#000" d="M12,38 H24 V46 H12 Z"/></mask></defs><g mask="url(#mpayments)"><path fill="#2E2E33" d="M6,16 Q6,12 10,12 H54 Q58,12 58,16 V48 Q58,52 54,52 H10 Q6,52 6,48 Z"/></g><path fill="#EC8638" d="M6,22 H58 V30 H6 Z"/><path fill="#EC8638" d="M32,40 H52 L51,44 H31 Z"/>',
    "photos": '<defs><mask id="mphotos" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><circle fill="#000" cx="32" cy="35" r="11"/></mask></defs><g mask="url(#mphotos)"><path fill="#2E2E33" d="M8,22 Q8,18 12,18 H20 L24,11 H40 L44,18 H52 Q56,18 56,22 V50 Q56,54 52,54 H12 Q8,54 8,50 Z"/></g><circle fill="#EC8638" cx="32" cy="35" r="5.5"/><path fill="#EC8638" d="M46,23 H52 V27 H46 Z"/>',
    "pickup": '<defs><mask id="mpickup" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><circle fill="#000" cx="21" cy="26" r="5"/></mask></defs><g mask="url(#mpickup)"><circle fill="#2E2E33" cx="21" cy="26" r="13"/><path fill="#2E2E33" d="M31,22 H58 V30 H52 V37 H45 V30 H31 Z"/></g><path fill="#EC8638" d="M12,48 H46 L44.6,52 H10.6 Z"/><path fill="#EC8638" d="M20,55 H40 L39,58 H19 Z" opacity=".6"/>',
    "ppf-film": '<defs><mask id="mppf-film" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><g transform="translate(0,8) scale(1)"><path fill="#000" d="M23.5,28.4 H38.8 Q39.8,28.4 40.6,29.2 L43.8,32.5 H21.2 Z"/></g><path fill="#000" d="M34,22 L40,22 L33,33 Z"/></mask></defs><g mask="url(#mppf-film)"><g transform="translate(0,8) scale(1)"><path fill="#2E2E33" d="M6,42 V37 Q6,35 8,34.5 L16,32.5 L22,26 Q23,25 25,25 H39 Q41,25 42.5,26.3 L48,32 L56,34 Q58,34.5 58,37 V42 Q58,44 56,44 H52 A6,6 0 0 0 40,44 H24 A6,6 0 0 0 12,44 H8 Q6,44 6,42 Z"/></g><g transform="translate(0,8) scale(1)"><circle fill="#2E2E33" cx="18" cy="44" r="4.8"/></g><g transform="translate(0,8) scale(1)"><circle fill="#2E2E33" cx="46" cy="44" r="4.8"/></g></g><g transform="translate(0,8) scale(1)"><path fill="#EC8638" d="M23,36 H46 L44.2,39.4 H21.2 Z"/></g><g transform="translate(0,8) scale(1)"><circle fill="#EC8638" cx="18" cy="44" r="1.8"/></g><g transform="translate(0,8) scale(1)"><circle fill="#EC8638" cx="46" cy="44" r="1.8"/></g><path fill="#EC8638" d="M34,22 H61 L57,50 H25 Z" opacity=".9"/><path fill="none" stroke="#EC8638" stroke-linecap="round" d="M10,16 H26 M14,11 H30" stroke-width="2.6"/>',
    "profile": '<defs><mask id="mprofile" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/></mask></defs><g mask="url(#mprofile)"><circle fill="#2E2E33" cx="32" cy="21" r="11"/><path fill="#2E2E33" d="M10,56 Q10,38 32,38 Q54,38 54,56 Z"/></g><path fill="#EC8638" d="M28,38.4 H36 L34.4,44.5 L36.4,53 L32,57 L27.6,53 L29.6,44.5 Z"/>',
    "search": '<defs><mask id="msearch" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><circle fill="#000" cx="27" cy="27" r="9.5"/></mask></defs><g mask="url(#msearch)"><circle fill="#2E2E33" cx="27" cy="27" r="18"/></g><path fill="none" stroke="#EC8638" stroke-linecap="round" d="M41,41 L56,56" stroke-width="7.5"/><path fill="#EC8638" d="M12,16 L16,12 L18,14 L14,18 Z"/>',
    "services": '<defs><mask id="mservices" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><g transform="translate(0,4) scale(1)"><path fill="#000" d="M23.5,28.4 H38.8 Q39.8,28.4 40.6,29.2 L43.8,32.5 H21.2 Z"/></g></mask></defs><g mask="url(#mservices)"><g transform="translate(0,4) scale(1)"><path fill="#2E2E33" d="M6,42 V37 Q6,35 8,34.5 L16,32.5 L22,26 Q23,25 25,25 H39 Q41,25 42.5,26.3 L48,32 L56,34 Q58,34.5 58,37 V42 Q58,44 56,44 H52 A6,6 0 0 0 40,44 H24 A6,6 0 0 0 12,44 H8 Q6,44 6,42 Z"/></g><g transform="translate(0,4) scale(1)"><circle fill="#2E2E33" cx="18" cy="44" r="4.8"/></g><g transform="translate(0,4) scale(1)"><circle fill="#2E2E33" cx="46" cy="44" r="4.8"/></g></g><g transform="translate(0,4) scale(1)"><path fill="#EC8638" d="M23,36 H46 L44.2,39.4 H21.2 Z"/></g><g transform="translate(0,4) scale(1)"><circle fill="#EC8638" cx="18" cy="44" r="1.8"/></g><g transform="translate(0,4) scale(1)"><circle fill="#EC8638" cx="46" cy="44" r="1.8"/></g><path fill="#EC8638" d="M10,10 H40 L38.6,13.6 H8.6 Z"/><path fill="#EC8638" d="M10,16 H31 L29.6,19.6 H8.6 Z"/><path fill="#EC8638" d="M10,22 H22 L20.6,25.6 H8.6 Z" opacity=".0"/>',
    "settings": '<defs><mask id="msettings" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/></mask></defs><g mask="url(#msettings)"><path fill="none" stroke="#2E2E33" stroke-linecap="round" d="M8,16 H56 M8,32 H56 M8,48 H56" stroke-width="4.2"/></g><path fill="#EC8638" d="M20,8 H31 L26,24 H15 Z"/><path fill="#EC8638" d="M36,24 H47 L42,40 H31 Z"/><path fill="#EC8638" d="M18,40 H29 L24,56 H13 Z"/>',
    "tools": '<defs><mask id="mtools" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><g transform="rotate(45 32 32)"><rect fill="#000" x="29.2" y="3" width="5.6" height="10" /></g></mask></defs><g mask="url(#mtools)"><g transform="rotate(45 32 32)"><circle fill="#2E2E33" cx="32" cy="14" r="10.5"/><path fill="#2E2E33" d="M32,7 V15" stroke="#000"/><rect fill="#2E2E33" x="28" y="22" width="8" height="34" rx="4"/></g></g><g transform="rotate(-45 32 32)"><rect fill="#EC8638" x="28.5" y="30" width="7" height="22" rx="3.5"/><path fill="#EC8638" d="M30.5,10 H33.5 V30 H30.5 Z"/></g>',
    "walk-in": '<defs><mask id="mwalk-in" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path fill="#000" d="M41,13 H51 V51 H41 Z"/></mask></defs><g mask="url(#mwalk-in)"><path fill="#2E2E33" d="M36,8 H56 V56 H36 Z"/></g><path fill="#EC8638" d="M6,29 H22 V22 L36,32 L22,42 V35 H6 Z"/><circle fill="#EC8638" cx="16" cy="14" r="0"/>',
    "wash": '<defs><mask id="mwash" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><g transform="translate(1,14) scale(0.9)"><path fill="#000" d="M23.5,28.4 H38.8 Q39.8,28.4 40.6,29.2 L43.8,32.5 H21.2 Z"/></g></mask></defs><g mask="url(#mwash)"><g transform="translate(1,14) scale(0.9)"><path fill="#2E2E33" d="M6,42 V37 Q6,35 8,34.5 L16,32.5 L22,26 Q23,25 25,25 H39 Q41,25 42.5,26.3 L48,32 L56,34 Q58,34.5 58,37 V42 Q58,44 56,44 H52 A6,6 0 0 0 40,44 H24 A6,6 0 0 0 12,44 H8 Q6,44 6,42 Z"/></g><g transform="translate(1,14) scale(0.9)"><circle fill="#2E2E33" cx="18" cy="44" r="4.8"/></g><g transform="translate(1,14) scale(0.9)"><circle fill="#2E2E33" cx="46" cy="44" r="4.8"/></g></g><g transform="translate(1,14) scale(0.9)"><path fill="#EC8638" d="M23,36 H46 L44.2,39.4 H21.2 Z"/></g><g transform="translate(1,14) scale(0.9)"><circle fill="#EC8638" cx="18" cy="44" r="1.8"/></g><g transform="translate(1,14) scale(0.9)"><circle fill="#EC8638" cx="46" cy="44" r="1.8"/></g><circle fill="none" stroke="#EC8638" stroke-width="3.4" cx="12" cy="13" r="5.2"/><circle fill="none" stroke="#EC8638" stroke-width="3.4" cx="27" cy="8" r="3.4"/><circle fill="none" stroke="#EC8638" stroke-width="3.4" cx="44" cy="13" r="6.2"/><circle fill="none" stroke="#EC8638" stroke-width="3.4" cx="57" cy="24" r="3"/><path fill="#EC8638" d="M20,24 Q22.2,28 20,30 Q17.8,28 20,24Z"/><path fill="#EC8638" d="M35,22 Q37,25.5 35,27.5 Q33,25.5 35,22Z"/>',
    "window-tint": '<defs><mask id="mwindow-tint" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/><path fill="#000" d="M12,33 H38.5 Q41,33 42.3,35.5 L47.6,46.5 H12 Z" opacity=".25"/></mask></defs><g mask="url(#mwindow-tint)"><path fill="#2E2E33" d="M5,26 H41 Q47,26 49.5,31 L59,52 H5 Z"/></g><circle fill="#EC8638" cx="46" cy="17" r="8"/><path fill="none" stroke="#EC8638" stroke-linecap="round" d="M46,3 V6 M60,17 H57 M56,7 L54,9.5 M36,7 L38,9.5" stroke-width="3"/><path fill="#EC8638" d="M5,50 H58 L59,52 H5 Z"/>'
  };
  var DUOTONE_ALIAS = { "coating": "ceramic", "ppf": "ppf-film", "tint": "window-tint", "inspect": "detailing", "wrench": "tools", "bell": "notifications", "club": "membership", "calendar": "bookings", "users": "profile", "pin": "pickup" };

  // ../../packages/ui/src/theme/icons.ts
  var P = {
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    services: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
    bookings: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    garage: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    profile: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    wash: '<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    ceramic: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
    coating: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
    ppf: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h6M7 14h10"/>',
    tint: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 12h16M9 3l-3 9M14 3l-3 9"/>',
    inspect: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/><path d="M8 10.5l2 2 3-3.5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 4.8 5.2L10 21a2.1 2.1 0 0 1-3-3l9.3-9.3"/><path d="M14.5 6.5 17 4"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/>',
    pin: '<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    club: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M9.5 4 12 9l2.5-5M12 9v11"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.9.8 3.1 2.6 3.5 5.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    tools: '<path d="M14.5 6.5a4 4 0 0 0 4.8 5.2L10 21a2.1 2.1 0 0 1-3-3l9.3-9.3"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/>',
    dot: '<circle cx="12" cy="12" r="4"/>'
  };
  var FILLABLE = ["home", "services", "bookings", "garage", "profile", "star", "calendar", "car", "users", "bell", "club", "tools", "wrench", "shield", "pin", "check", "search"];
  var DUO_VIEWBOX = "2 2 60 60";
  function duotoneInner(name) {
    return DUOTONE[name] ?? DUOTONE[DUOTONE_ALIAS[name] ?? ""] ?? null;
  }
  function iconInner(name) {
    return duotoneInner(name) ?? P[name] ?? "";
  }
  function iconMarkup(name, color, size = 24, filled = false) {
    const duo = duotoneInner(name);
    if (duo) return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${DUO_VIEWBOX}">${duo}</svg>`;
    const fill = filled && FILLABLE.includes(name) ? color : "none";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" fill-opacity="${fill === "none" ? 0 : 0.22}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] ?? ""}</svg>`;
  }

  // ../../packages/ui/src/theme/logo.ts
  var LOGO_HORIZONTAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2984 640" width="2984" height="640"><g transform="translate(23.20,-146.40) scale(0.4)"><path d="M1447,666 L1953,666 A500,500 0 0 1 1953,1666 L1600,1666 C1500,1666 1460,1610 1405,1540 L1064,930 Q1050,903 1036,918 L400,1662 L262,1662 Q244,1660 252,1636 L1006,716 Q1066,660 1141,743 L1546,1459 C1585,1512 1615,1520 1700,1520 L1950,1520 A353,353 0 0 0 1950,814 L1497,814 L1466,786 L1415,696 L1425,674 Z" fill="#0B0B0C"/><path d="M756,1494 L995,1500 L1072,1662 L612,1662 Z" fill="#EC8638"/></g><path d="M1462.30,392.21 L1457.96,391.95 L1453.84,391.61 L1449.94,391.18 L1446.24,390.66 L1442.78,390.06 L1441.10,389.73 L1439.47,389.36 L1436.35,388.52 L1433.38,387.53 L1430.58,386.38 L1427.95,385.07 L1425.49,383.61 L1423.20,381.99 L1421.11,380.23 L1420.11,379.26 L1419.15,378.25 L1417.38,376.13 L1415.75,373.78 L1414.28,371.24 L1412.96,368.51 L1411.78,365.59 L1410.76,362.48 L1409.88,359.20 L1409.49,357.46 L1409.13,355.68 L1408.50,351.97 L1407.96,348.00 L1407.51,343.79 L1407.15,339.33 L1406.88,334.62 L1406.70,329.66 L1406.61,324.45 L1406.60,321.75 L1406.60,250.34 L1427.80,250.34 L1427.80,321.74 L1427.81,325.38 L1427.94,332.18 L1428.20,338.33 L1428.58,343.83 L1428.82,346.31 L1429.11,348.63 L1429.85,352.94 L1430.54,355.81 L1431.06,357.54 L1431.63,359.15 L1432.26,360.64 L1432.58,361.32 L1432.91,361.96 L1433.64,363.22 L1434.43,364.37 L1435.29,365.43 L1436.20,366.41 L1437.19,367.30 L1438.25,368.11 L1439.39,368.85 L1439.96,369.17 L1440.57,369.48 L1441.92,370.10 L1443.36,370.65 L1444.90,371.15 L1447.42,371.79 L1451.19,372.46 L1453.20,372.70 L1455.36,372.89 L1460.09,373.22 L1465.31,373.43 L1471.03,373.54 L1474.07,373.56 L1505.87,373.56 L1508.93,373.54 L1514.67,373.43 L1519.90,373.22 L1524.62,372.89 L1526.77,372.70 L1528.78,372.46 L1532.53,371.79 L1535.04,371.15 L1536.57,370.65 L1538.00,370.10 L1539.34,369.49 L1539.95,369.17 L1540.53,368.85 L1541.68,368.11 L1542.74,367.29 L1543.73,366.40 L1544.65,365.43 L1545.51,364.37 L1546.30,363.22 L1547.03,361.96 L1547.36,361.32 L1547.68,360.64 L1548.31,359.15 L1548.88,357.54 L1549.39,355.81 L1550.08,352.94 L1550.81,348.64 L1551.09,346.31 L1551.34,343.83 L1551.73,338.32 L1552.00,332.18 L1552.13,325.38 L1552.15,321.74 L1552.15,250.34 L1573.34,250.34 L1573.34,321.75 L1573.33,324.45 L1573.24,329.66 L1573.06,334.62 L1572.79,339.33 L1572.42,343.79 L1571.97,348.01 L1571.42,351.97 L1570.78,355.68 L1570.43,357.46 L1570.04,359.19 L1569.17,362.48 L1568.15,365.59 L1566.98,368.51 L1565.66,371.24 L1564.19,373.78 L1562.56,376.13 L1560.80,378.25 L1559.83,379.26 L1558.83,380.23 L1556.75,381.99 L1554.47,383.61 L1552.01,385.07 L1549.37,386.38 L1546.57,387.53 L1543.60,388.52 L1540.48,389.36 L1538.84,389.73 L1537.17,390.06 L1533.70,390.66 L1530.01,391.18 L1526.10,391.61 L1521.98,391.95 L1517.65,392.21 L1510.75,392.43 L1505.89,392.47 L1474.06,392.47 L1469.19,392.43 Z M1276.59,252.50 L1354.40,387.50 L1330.03,387.50 L1264.40,273.64 L1198.77,387.50 L1174.40,387.50 L1252.21,252.50 Z M1625.54,250.34 L1781.74,250.34 L1781.74,268.72 L1714.24,268.72 L1714.24,389.66 L1693.04,389.66 L1693.04,268.72 L1625.54,268.72 Z M1881.18,391.61 L1877.27,391.18 L1873.58,390.66 L1870.11,390.06 L1868.44,389.73 L1866.80,389.36 L1863.68,388.52 L1860.72,387.53 L1857.92,386.38 L1855.29,385.07 L1852.83,383.61 L1850.54,381.99 L1848.45,380.23 L1847.45,379.26 L1846.48,378.25 L1844.72,376.13 L1843.09,373.78 L1841.62,371.24 L1840.29,368.51 L1839.12,365.59 L1838.09,362.48 L1837.22,359.20 L1836.82,357.46 L1836.47,355.68 L1835.84,351.97 L1835.30,348.00 L1834.84,343.79 L1834.49,339.33 L1834.22,334.62 L1834.04,329.66 L1833.95,324.45 L1833.94,321.75 L1833.94,318.22 L1833.96,313.80 L1834.18,305.51 L1834.62,297.91 L1835.29,291.03 L1835.70,287.83 L1835.94,286.27 L1836.48,283.31 L1837.09,280.47 L1837.80,277.76 L1838.58,275.19 L1839.46,272.76 L1840.42,270.46 L1841.47,268.32 L1842.03,267.27 L1842.63,266.26 L1843.87,264.35 L1845.23,262.54 L1846.70,260.85 L1848.27,259.28 L1849.96,257.83 L1851.74,256.50 L1853.61,255.30 L1854.61,254.74 L1855.62,254.20 L1857.70,253.23 L1859.90,252.34 L1862.21,251.53 L1864.64,250.82 L1867.19,250.19 L1869.85,249.65 L1872.61,249.20 L1874.05,249.01 L1876.98,248.66 L1883.25,248.10 L1890.09,247.73 L1897.48,247.55 L1901.40,247.53 L1936.82,247.53 L1940.73,247.55 L1948.13,247.73 L1954.97,248.10 L1961.24,248.66 L1964.17,249.01 L1965.61,249.20 L1968.37,249.65 L1971.03,250.19 L1973.57,250.82 L1976.00,251.53 L1978.32,252.34 L1980.52,253.23 L1982.59,254.20 L1983.61,254.74 L1984.60,255.30 L1986.48,256.50 L1988.26,257.83 L1989.94,259.28 L1991.52,260.85 L1992.99,262.54 L1994.35,264.35 L1995.59,266.26 L1996.18,267.27 L1996.75,268.32 L1997.79,270.46 L1998.75,272.76 L1999.63,275.20 L2000.41,277.76 L2001.11,280.47 L2001.72,283.31 L2002.25,286.28 L2002.49,287.83 L2002.91,291.02 L2003.58,297.91 L2004.03,305.51 L2004.25,313.80 L2004.28,318.22 L2004.28,321.75 L2004.27,324.45 L2004.18,329.66 L2004.00,334.62 L2003.72,339.33 L2003.36,343.79 L2002.91,348.01 L2002.36,351.97 L2001.72,355.68 L2001.36,357.46 L2000.98,359.19 L2000.10,362.48 L1999.08,365.59 L1997.91,368.51 L1996.59,371.24 L1995.12,373.78 L1993.50,376.13 L1991.73,378.25 L1990.77,379.26 L1989.77,380.23 L1987.69,381.99 L1985.40,383.61 L1982.94,385.07 L1980.31,386.38 L1977.51,387.53 L1974.54,388.52 L1971.41,389.36 L1969.77,389.73 L1968.10,390.06 L1964.63,390.66 L1960.94,391.18 L1957.04,391.61 L1952.92,391.95 L1948.58,392.21 L1941.69,392.43 L1936.82,392.47 L1901.39,392.47 L1896.53,392.43 L1889.63,392.21 L1885.30,391.95 Z M1950.86,373.22 L1955.60,372.89 L1957.76,372.70 L1959.78,372.46 L1963.56,371.79 L1966.08,371.15 L1967.61,370.65 L1969.05,370.10 L1970.39,369.49 L1971.00,369.17 L1971.57,368.85 L1972.71,368.11 L1973.76,367.30 L1974.74,366.41 L1975.65,365.44 L1976.50,364.38 L1977.28,363.23 L1978.00,361.97 L1978.32,361.33 L1978.64,360.65 L1979.25,359.17 L1980.09,356.70 L1981.02,352.93 L1981.75,348.64 L1982.03,346.31 L1982.27,343.83 L1982.67,338.32 L1982.93,332.18 L1983.07,325.38 L1983.08,321.74 L1983.08,318.23 L1983.07,314.47 L1982.93,307.46 L1982.67,301.14 L1982.27,295.52 L1982.03,292.98 L1981.75,290.61 L1981.02,286.26 L1980.34,283.37 L1979.82,281.64 L1979.26,280.04 L1978.64,278.56 L1978.33,277.89 L1978.00,277.26 L1977.29,276.03 L1976.51,274.91 L1975.68,273.89 L1974.77,272.96 L1973.80,272.12 L1972.76,271.36 L1971.63,270.68 L1971.06,270.38 L1970.46,270.09 L1969.12,269.54 L1966.92,268.79 L1963.59,267.99 L1959.82,267.40 L1957.80,267.20 L1955.63,267.02 L1950.88,266.74 L1945.63,266.55 L1939.87,266.46 L1936.81,266.44 L1901.41,266.44 L1898.34,266.46 L1892.59,266.55 L1887.34,266.74 L1882.59,267.02 L1880.42,267.19 L1878.40,267.40 L1874.64,267.99 L1871.31,268.79 L1869.10,269.54 L1867.76,270.09 L1867.15,270.38 L1866.58,270.68 L1865.45,271.36 L1864.41,272.12 L1863.43,272.96 L1862.53,273.89 L1861.69,274.91 L1860.91,276.03 L1860.18,277.27 L1859.86,277.89 L1859.55,278.55 L1858.94,280.03 L1858.38,281.64 L1857.86,283.37 L1857.18,286.26 L1856.45,290.62 L1856.16,292.98 L1855.92,295.51 L1855.54,301.14 L1855.28,307.46 L1855.15,314.47 L1855.13,318.23 L1855.13,321.74 L1855.15,325.38 L1855.28,332.18 L1855.54,338.33 L1855.92,343.83 L1856.16,346.32 L1856.45,348.64 L1857.18,352.93 L1858.12,356.70 L1858.94,359.17 L1859.55,360.66 L1859.86,361.33 L1860.19,361.96 L1860.92,363.22 L1861.70,364.37 L1862.55,365.43 L1863.46,366.41 L1864.45,367.30 L1865.50,368.11 L1866.65,368.85 L1867.22,369.17 L1867.82,369.48 L1869.17,370.10 L1870.61,370.65 L1872.15,371.15 L1874.67,371.79 L1878.44,372.46 L1880.45,372.70 L1882.61,372.89 L1887.36,373.22 L1892.60,373.43 L1898.35,373.54 L1901.41,373.56 L1936.81,373.56 L1939.87,373.54 L1945.62,373.43 Z M2172.77,250.68 L2179.02,251.10 L2182.92,251.48 L2186.60,251.94 L2190.07,252.47 L2191.73,252.77 L2193.37,253.09 L2196.49,253.85 L2199.45,254.76 L2202.25,255.81 L2204.88,257.03 L2207.34,258.39 L2209.63,259.92 L2211.73,261.58 L2212.73,262.49 L2213.70,263.46 L2215.47,265.48 L2217.10,267.72 L2218.58,270.16 L2219.91,272.78 L2221.08,275.59 L2222.10,278.59 L2222.98,281.75 L2223.37,283.42 L2223.73,285.13 L2224.37,288.71 L2224.91,292.55 L2225.37,296.65 L2225.73,300.99 L2226.00,305.60 L2226.18,310.46 L2226.27,315.57 L2226.29,318.22 L2226.29,321.75 L2226.27,324.32 L2226.18,329.29 L2226.00,334.02 L2225.73,338.51 L2225.37,342.77 L2224.91,346.80 L2224.36,350.59 L2223.73,354.14 L2223.37,355.85 L2222.98,357.51 L2222.10,360.67 L2221.08,363.67 L2219.91,366.49 L2218.59,369.12 L2217.11,371.58 L2215.48,373.85 L2213.72,375.91 L2212.75,376.90 L2211.75,377.83 L2209.66,379.54 L2207.37,381.11 L2204.91,382.53 L2202.28,383.79 L2199.48,384.90 L2196.52,385.86 L2193.40,386.67 L2191.77,387.03 L2190.09,387.35 L2186.63,387.93 L2182.94,388.42 L2179.04,388.83 L2174.92,389.16 L2170.59,389.41 L2163.70,389.62 L2158.83,389.66 L2056.48,389.66 L2056.48,250.34 L2158.83,250.34 L2163.70,250.38 Z M2175.91,370.17 L2181.38,369.62 L2183.80,369.28 L2184.91,369.09 L2187.05,368.63 L2189.02,368.08 L2190.84,367.43 L2192.51,366.69 L2194.03,365.85 L2195.40,364.93 L2196.66,363.91 L2197.20,363.39 L2197.72,362.84 L2198.75,361.57 L2199.69,360.16 L2200.54,358.57 L2201.32,356.81 L2202.01,354.87 L2202.62,352.76 L2203.13,350.45 L2203.35,349.26 L2203.75,346.65 L2204.41,340.68 L2204.84,333.80 L2205.06,325.99 L2205.09,321.74 L2205.09,318.23 L2205.07,314.69 L2204.94,308.09 L2204.68,302.13 L2204.28,296.82 L2204.04,294.42 L2203.76,292.19 L2203.03,288.07 L2202.35,285.34 L2201.84,283.71 L2201.28,282.20 L2200.67,280.81 L2200.36,280.19 L2200.04,279.59 L2199.32,278.43 L2198.55,277.38 L2197.72,276.41 L2196.81,275.52 L2195.84,274.72 L2194.79,273.99 L2193.65,273.33 L2193.07,273.04 L2192.46,272.76 L2191.12,272.22 L2188.92,271.50 L2185.59,270.72 L2181.83,270.15 L2179.81,269.95 L2177.65,269.79 L2172.89,269.53 L2167.64,269.36 L2161.88,269.27 L2158.82,269.26 L2077.67,269.26 L2077.67,370.74 L2158.81,370.74 L2162.62,370.72 L2169.66,370.54 Z M2478.53,305.51 L2478.97,297.91 L2479.63,291.03 L2480.05,287.83 L2480.29,286.27 L2480.82,283.31 L2481.44,280.47 L2482.15,277.76 L2482.93,275.19 L2483.81,272.76 L2484.77,270.46 L2485.82,268.32 L2486.38,267.27 L2486.98,266.26 L2488.22,264.35 L2489.58,262.54 L2491.05,260.85 L2492.62,259.28 L2494.30,257.83 L2496.09,256.50 L2497.96,255.30 L2498.96,254.74 L2499.97,254.20 L2502.05,253.23 L2504.25,252.34 L2506.56,251.53 L2508.99,250.82 L2511.54,250.19 L2514.19,249.65 L2516.96,249.20 L2518.39,249.01 L2521.33,248.66 L2527.60,248.10 L2534.44,247.73 L2541.83,247.55 L2545.75,247.53 L2581.17,247.53 L2585.64,247.55 L2594.04,247.77 L2601.74,248.20 L2608.74,248.85 L2612.00,249.26 L2613.59,249.50 L2616.63,250.05 L2619.53,250.71 L2622.29,251.48 L2624.91,252.37 L2627.39,253.37 L2629.71,254.48 L2631.88,255.71 L2632.93,256.38 L2633.95,257.09 L2635.86,258.60 L2637.64,260.29 L2639.28,262.14 L2640.77,264.14 L2642.11,266.29 L2643.30,268.59 L2644.35,271.02 L2644.82,272.32 L2645.26,273.64 L2646.04,276.39 L2646.71,279.35 L2647.26,282.49 L2647.71,285.82 L2648.03,289.34 L2648.25,293.06 L2648.36,296.96 L2648.39,301.15 L2627.20,301.15 L2627.14,295.96 L2626.86,290.40 L2626.47,286.74 L2626.12,284.54 L2625.71,282.53 L2625.23,280.69 L2624.98,279.86 L2624.71,279.07 L2624.10,277.56 L2623.42,276.20 L2622.65,274.96 L2621.82,273.84 L2620.90,272.84 L2619.91,271.96 L2618.81,271.16 L2618.26,270.81 L2617.66,270.48 L2616.32,269.82 L2614.86,269.24 L2613.26,268.71 L2611.54,268.25 L2609.68,267.86 L2607.68,267.54 L2605.55,267.29 L2604.44,267.20 L2602.08,267.02 L2596.86,266.74 L2591.04,266.55 L2584.60,266.46 L2581.16,266.44 L2545.76,266.44 L2542.69,266.46 L2536.94,266.55 L2531.69,266.74 L2526.94,267.02 L2524.77,267.19 L2522.75,267.40 L2518.99,267.99 L2515.66,268.79 L2513.45,269.54 L2512.11,270.09 L2511.50,270.38 L2510.93,270.68 L2509.80,271.36 L2508.76,272.12 L2507.78,272.96 L2506.88,273.89 L2506.03,274.91 L2505.26,276.03 L2504.53,277.27 L2504.21,277.89 L2503.90,278.55 L2503.29,280.03 L2502.73,281.64 L2502.21,283.37 L2501.53,286.26 L2500.80,290.62 L2500.51,292.98 L2500.27,295.51 L2499.88,301.14 L2499.63,307.46 L2499.50,314.47 L2499.48,318.23 L2499.48,321.74 L2499.50,325.38 L2499.63,332.18 L2499.88,338.33 L2500.27,343.83 L2500.51,346.32 L2500.79,348.64 L2501.53,352.93 L2502.47,356.70 L2503.29,359.17 L2503.90,360.66 L2504.21,361.33 L2504.54,361.96 L2505.27,363.22 L2506.05,364.37 L2506.90,365.43 L2507.81,366.41 L2508.80,367.30 L2509.85,368.11 L2511.00,368.85 L2511.57,369.17 L2512.17,369.48 L2513.52,370.10 L2514.96,370.65 L2516.50,371.15 L2519.02,371.79 L2522.79,372.46 L2524.80,372.70 L2526.96,372.89 L2531.70,373.22 L2536.95,373.43 L2542.70,373.54 L2545.76,373.56 L2581.16,373.56 L2587.90,373.52 L2596.88,373.31 L2602.10,373.08 L2604.46,372.94 L2606.66,372.76 L2609.72,372.35 L2611.58,371.99 L2613.31,371.57 L2614.90,371.08 L2616.36,370.54 L2617.71,369.92 L2618.31,369.61 L2618.85,369.29 L2619.95,368.53 L2620.93,367.68 L2621.84,366.72 L2622.67,365.64 L2623.43,364.44 L2624.11,363.11 L2624.72,361.63 L2624.98,360.87 L2625.24,360.05 L2625.71,358.22 L2626.12,356.23 L2626.47,354.05 L2626.86,350.41 L2627.14,344.89 L2627.21,339.72 L2648.39,339.72 L2648.36,343.91 L2648.25,347.81 L2648.03,351.52 L2647.70,355.03 L2647.26,358.35 L2646.71,361.48 L2646.04,364.41 L2645.26,367.14 L2644.82,368.45 L2644.34,369.73 L2643.30,372.12 L2642.10,374.39 L2640.75,376.51 L2639.26,378.47 L2637.62,380.28 L2635.84,381.93 L2633.93,383.40 L2632.90,384.09 L2631.84,384.73 L2629.68,385.91 L2627.35,386.98 L2624.88,387.93 L2622.26,388.78 L2619.50,389.51 L2616.60,390.13 L2613.57,390.64 L2611.98,390.85 L2608.73,391.23 L2601.73,391.84 L2594.03,392.25 L2585.63,392.45 L2581.17,392.47 L2545.74,392.47 L2540.87,392.43 L2533.98,392.21 L2529.64,391.95 L2525.53,391.61 L2521.62,391.18 L2517.93,390.66 L2514.46,390.06 L2512.79,389.73 L2511.15,389.36 L2508.03,388.52 L2505.07,387.53 L2502.27,386.38 L2499.64,385.07 L2497.18,383.61 L2494.89,381.99 L2492.80,380.23 L2491.80,379.26 L2490.83,378.25 L2489.07,376.13 L2487.44,373.78 L2485.97,371.24 L2484.64,368.51 L2483.47,365.59 L2482.44,362.48 L2481.56,359.20 L2481.17,357.46 L2480.82,355.68 L2480.19,351.97 L2479.64,348.00 L2479.19,343.79 L2478.83,339.33 L2478.57,334.62 L2478.39,329.66 L2478.30,324.45 L2478.29,321.75 L2478.29,318.22 L2478.31,313.80 Z M2721.78,309.40 L2741.38,309.40 L2828.65,250.34 L2860.74,250.34 L2860.88,250.80 L2762.78,318.60 L2863.68,389.24 L2863.55,389.66 L2831.45,389.66 L2741.45,327.79 L2721.78,327.79 L2721.78,389.66 L2700.59,389.66 L2700.59,250.34 L2721.78,250.34 Z" fill="#0B0B0C" fill-rule="evenodd"/><path d="M2278.49,365.23 L2413.84,365.23 L2426.09,387.50 L2278.49,387.50 Z M2426.09,308.86 L2413.84,331.14 L2278.49,331.14 L2278.49,308.86 Z M2426.09,252.50 L2413.84,274.77 L2278.49,274.77 L2278.49,252.50 Z" fill="#EC8638" fill-rule="evenodd"/></svg>';
  var LOGO_MARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1124 640" width="1124" height="640"><g transform="translate(23.20,-146.40) scale(0.4)"><path d="M1447,666 L1953,666 A500,500 0 0 1 1953,1666 L1600,1666 C1500,1666 1460,1610 1405,1540 L1064,930 Q1050,903 1036,918 L400,1662 L262,1662 Q244,1660 252,1636 L1006,716 Q1066,660 1141,743 L1546,1459 C1585,1512 1615,1520 1700,1520 L1950,1520 A353,353 0 0 0 1950,814 L1497,814 L1466,786 L1415,696 L1425,674 Z" fill="#0B0B0C"/><path d="M756,1494 L995,1500 L1072,1662 L612,1662 Z" fill="#EC8638"/></g></svg>';
  var LOGO_HORIZONTAL_RATIO = 2984 / 640;
  var LOGO_MARK_RATIO = 1124 / 640;
  var logoDataUri = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  var LOGO_STACKED_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1627 856" width="1627" height="856"><g transform="translate(274.30,-146.40) scale(0.4)"><path d="M1447,666 L1953,666 A500,500 0 0 1 1953,1666 L1600,1666 C1500,1666 1460,1610 1405,1540 L1064,930 Q1050,903 1036,918 L400,1662 L262,1662 Q244,1660 252,1636 L1006,716 Q1066,660 1141,743 L1546,1459 C1585,1512 1615,1520 1700,1520 L1950,1520 A353,353 0 0 0 1950,814 L1497,814 L1466,786 L1415,696 L1425,674 Z" fill="#0B0B0C"/><path d="M756,1494 L995,1500 L1072,1662 L612,1662 Z" fill="#EC8638"/></g><path d="M376.09,739.71 L372.68,739.51 L369.45,739.24 L366.38,738.91 L363.48,738.50 L360.76,738.03 L359.44,737.76 L358.16,737.48 L355.71,736.82 L353.38,736.04 L351.18,735.13 L349.11,734.11 L347.18,732.96 L345.39,731.69 L343.74,730.31 L342.96,729.55 L342.20,728.75 L340.81,727.08 L339.54,725.24 L338.38,723.25 L337.34,721.11 L336.42,718.81 L335.61,716.37 L334.92,713.79 L334.61,712.43 L334.34,711.03 L333.84,708.11 L333.41,705.00 L333.06,701.69 L332.78,698.19 L332.57,694.49 L332.43,690.59 L332.36,686.50 L332.35,684.38 L332.35,628.30 L348.99,628.30 L348.99,684.37 L349.00,687.23 L349.11,692.57 L349.31,697.40 L349.61,701.72 L349.80,703.67 L350.02,705.49 L350.61,708.87 L351.15,711.13 L351.56,712.49 L352.01,713.75 L352.50,714.92 L352.75,715.45 L353.01,715.96 L353.58,716.95 L354.20,717.85 L354.87,718.68 L355.60,719.45 L356.37,720.15 L357.20,720.79 L358.10,721.37 L358.55,721.62 L359.02,721.87 L360.08,722.35 L361.22,722.78 L362.42,723.17 L364.40,723.68 L367.36,724.20 L368.94,724.39 L370.64,724.55 L374.35,724.80 L378.45,724.97 L382.94,725.05 L385.33,725.07 L410.31,725.07 L412.71,725.05 L417.22,724.97 L421.32,724.80 L425.03,724.55 L426.72,724.39 L428.29,724.20 L431.24,723.68 L433.21,723.17 L434.41,722.78 L435.54,722.35 L436.59,721.87 L437.07,721.62 L437.52,721.37 L438.43,720.79 L439.26,720.15 L440.04,719.45 L440.76,718.68 L441.43,717.85 L442.05,716.95 L442.63,715.96 L442.89,715.45 L443.14,714.92 L443.63,713.75 L444.08,712.49 L444.48,711.13 L445.02,708.88 L445.60,705.50 L445.82,703.67 L446.01,701.72 L446.32,697.40 L446.53,692.57 L446.63,687.23 L446.65,684.37 L446.65,628.30 L463.29,628.30 L463.29,684.38 L463.28,686.50 L463.21,690.59 L463.07,694.49 L462.86,698.19 L462.57,701.69 L462.21,705.00 L461.78,708.12 L461.28,711.03 L461.00,712.43 L460.70,713.79 L460.01,716.37 L459.21,718.81 L458.29,721.10 L457.26,723.25 L456.10,725.24 L454.82,727.08 L453.44,728.75 L452.68,729.55 L451.90,730.30 L450.26,731.69 L448.47,732.96 L446.54,734.11 L444.47,735.13 L442.27,736.04 L439.94,736.82 L437.48,737.48 L436.19,737.76 L434.88,738.03 L432.16,738.50 L429.26,738.91 L426.19,739.24 L422.96,739.51 L419.55,739.71 L414.14,739.89 L410.32,739.92 L385.32,739.92 L381.50,739.89 Z M230.25,630.00 L291.35,736.02 L272.21,736.02 L220.68,646.60 L169.14,736.02 L150.00,736.02 L211.11,630.00 Z M504.28,628.30 L626.94,628.30 L626.94,642.74 L573.94,642.74 L573.94,737.71 L557.29,737.71 L557.29,642.74 L504.28,642.74 Z M705.03,739.24 L701.97,738.91 L699.07,738.50 L696.35,738.03 L695.03,737.76 L693.75,737.48 L691.30,736.82 L688.97,736.04 L686.77,735.13 L684.70,734.11 L682.77,732.96 L680.98,731.69 L679.33,730.31 L678.55,729.55 L677.79,728.75 L676.40,727.08 L675.13,725.24 L673.97,723.25 L672.93,721.11 L672.01,718.81 L671.20,716.37 L670.51,713.79 L670.20,712.43 L669.93,711.03 L669.43,708.11 L669.00,705.00 L668.65,701.69 L668.37,698.19 L668.16,694.49 L668.02,690.59 L667.95,686.50 L667.94,684.38 L667.94,681.61 L667.96,678.14 L668.13,671.63 L668.48,665.66 L669.00,660.25 L669.32,657.75 L669.51,656.52 L669.93,654.19 L670.42,651.96 L670.97,649.84 L671.59,647.82 L672.27,645.91 L673.03,644.11 L673.85,642.42 L674.29,641.60 L674.76,640.80 L675.74,639.31 L676.80,637.89 L677.96,636.56 L679.20,635.33 L680.52,634.19 L681.92,633.14 L683.39,632.20 L684.17,631.76 L684.97,631.34 L686.59,630.57 L688.32,629.87 L690.14,629.24 L692.05,628.68 L694.05,628.19 L696.14,627.77 L698.30,627.41 L699.43,627.26 L701.74,626.98 L706.66,626.55 L712.03,626.26 L717.84,626.11 L720.91,626.10 L748.73,626.10 L751.80,626.11 L757.61,626.26 L762.98,626.55 L767.90,626.98 L770.21,627.26 L771.34,627.41 L773.51,627.77 L775.59,628.19 L777.59,628.68 L779.50,629.24 L781.32,629.87 L783.05,630.57 L784.68,631.34 L785.47,631.76 L786.26,632.20 L787.73,633.14 L789.13,634.19 L790.45,635.33 L791.68,636.56 L792.84,637.89 L793.91,639.31 L794.88,640.80 L795.35,641.60 L795.79,642.42 L796.61,644.11 L797.37,645.91 L798.05,647.82 L798.67,649.84 L799.22,651.96 L799.70,654.20 L800.11,656.53 L800.30,657.75 L800.63,660.25 L801.16,665.66 L801.51,671.63 L801.68,678.14 L801.71,681.61 L801.71,684.38 L801.70,686.50 L801.63,690.59 L801.48,694.49 L801.27,698.19 L800.99,701.69 L800.63,705.00 L800.20,708.12 L799.70,711.03 L799.42,712.43 L799.11,713.79 L798.43,716.37 L797.63,718.81 L796.71,721.10 L795.67,723.25 L794.52,725.24 L793.24,727.08 L791.85,728.75 L791.10,729.55 L790.31,730.30 L788.68,731.69 L786.88,732.96 L784.95,734.11 L782.88,735.13 L780.68,736.04 L778.35,736.82 L775.90,737.48 L774.61,737.76 L773.30,738.03 L770.57,738.50 L767.67,738.91 L764.61,739.24 L761.37,739.51 L757.97,739.71 L752.56,739.89 L748.73,739.92 L720.91,739.92 L717.09,739.89 L711.68,739.71 L708.27,739.51 Z M759.76,724.80 L763.48,724.55 L765.18,724.39 L766.76,724.20 L769.73,723.68 L771.71,723.17 L772.91,722.78 L774.04,722.35 L775.10,721.87 L775.57,721.62 L776.02,721.37 L776.92,720.79 L777.74,720.15 L778.51,719.45 L779.23,718.69 L779.89,717.86 L780.50,716.95 L781.07,715.97 L781.32,715.46 L781.57,714.93 L782.05,713.77 L782.71,711.83 L783.44,708.87 L784.01,705.50 L784.23,703.67 L784.43,701.72 L784.74,697.40 L784.94,692.57 L785.05,687.23 L785.06,684.37 L785.06,681.62 L785.05,678.67 L784.94,673.16 L784.74,668.20 L784.43,663.78 L784.23,661.79 L784.01,659.93 L783.44,656.51 L782.91,654.24 L782.50,652.88 L782.06,651.63 L781.58,650.47 L781.33,649.94 L781.07,649.44 L780.51,648.48 L779.90,647.60 L779.25,646.80 L778.54,646.07 L777.78,645.41 L776.96,644.81 L776.07,644.27 L775.62,644.04 L775.15,643.82 L774.10,643.38 L772.37,642.79 L769.75,642.16 L766.80,641.70 L765.20,641.54 L763.50,641.40 L759.77,641.18 L755.65,641.03 L751.13,640.96 L748.72,640.95 L720.92,640.95 L718.52,640.96 L714.00,641.03 L709.87,641.18 L706.14,641.40 L704.44,641.54 L702.85,641.70 L699.90,642.16 L697.28,642.79 L695.55,643.38 L694.50,643.82 L694.02,644.04 L693.57,644.28 L692.68,644.81 L691.86,645.41 L691.10,646.07 L690.39,646.80 L689.73,647.60 L689.12,648.48 L688.55,649.45 L688.29,649.94 L688.05,650.46 L687.57,651.62 L687.13,652.88 L686.73,654.24 L686.19,656.51 L685.61,659.94 L685.39,661.79 L685.20,663.78 L684.90,668.20 L684.70,673.16 L684.59,678.67 L684.58,681.62 L684.58,684.37 L684.59,687.23 L684.70,692.57 L684.90,697.40 L685.20,701.72 L685.39,703.67 L685.61,705.50 L686.19,708.87 L686.92,711.83 L687.57,713.77 L688.05,714.94 L688.30,715.46 L688.55,715.96 L689.12,716.95 L689.74,717.85 L690.41,718.69 L691.12,719.45 L691.90,720.15 L692.72,720.79 L693.62,721.37 L694.07,721.62 L694.55,721.87 L695.61,722.35 L696.74,722.78 L697.94,723.17 L699.93,723.68 L702.88,724.20 L704.46,724.39 L706.16,724.55 L709.89,724.80 L714.00,724.97 L718.52,725.05 L720.92,725.07 L748.72,725.07 L751.12,725.05 L755.64,724.97 Z M934.02,628.57 L938.93,628.90 L941.99,629.20 L944.89,629.56 L947.61,629.98 L948.92,630.21 L950.20,630.47 L952.65,631.06 L954.98,631.77 L957.17,632.60 L959.24,633.55 L961.17,634.63 L962.97,635.82 L964.62,637.13 L965.41,637.85 L966.17,638.60 L967.56,640.19 L968.84,641.95 L970.00,643.87 L971.04,645.93 L971.96,648.13 L972.77,650.48 L973.45,652.97 L973.76,654.28 L974.04,655.63 L974.54,658.44 L974.97,661.45 L975.33,664.67 L975.61,668.08 L975.83,671.70 L975.97,675.51 L976.04,679.53 L976.05,681.61 L976.05,684.38 L976.04,686.40 L975.97,690.30 L975.83,694.02 L975.61,697.55 L975.33,700.89 L974.97,704.05 L974.54,707.03 L974.04,709.82 L973.76,711.16 L973.45,712.47 L972.77,714.95 L971.96,717.30 L971.04,719.51 L970.00,721.58 L968.84,723.51 L967.57,725.30 L966.18,726.91 L965.42,727.69 L964.63,728.42 L962.99,729.77 L961.19,731.00 L959.26,732.11 L957.20,733.10 L955.00,733.97 L952.67,734.73 L950.23,735.37 L948.94,735.65 L947.63,735.90 L944.91,736.35 L942.01,736.74 L938.94,737.06 L935.71,737.32 L932.31,737.51 L926.90,737.68 L923.08,737.71 L842.70,737.71 L842.70,628.30 L923.07,628.30 L926.90,628.33 Z M936.49,722.40 L940.79,721.97 L942.69,721.71 L943.55,721.56 L945.24,721.20 L946.79,720.76 L948.22,720.25 L949.53,719.67 L950.72,719.02 L951.80,718.29 L952.78,717.49 L953.21,717.08 L953.61,716.65 L954.42,715.66 L955.16,714.54 L955.83,713.30 L956.44,711.92 L956.99,710.39 L957.46,708.73 L957.87,706.92 L958.04,705.98 L958.35,703.93 L958.87,699.25 L959.21,693.85 L959.38,687.71 L959.41,684.37 L959.41,681.62 L959.39,678.84 L959.29,673.65 L959.08,668.98 L958.77,664.81 L958.58,662.92 L958.36,661.17 L957.79,657.93 L957.25,655.79 L956.85,654.51 L956.41,653.32 L955.93,652.23 L955.69,651.74 L955.43,651.28 L954.87,650.36 L954.27,649.53 L953.61,648.77 L952.90,648.08 L952.14,647.45 L951.32,646.88 L950.42,646.36 L949.96,646.13 L949.49,645.91 L948.44,645.48 L946.71,644.92 L944.09,644.30 L941.14,643.86 L939.55,643.71 L937.85,643.58 L934.12,643.37 L929.99,643.24 L925.47,643.17 L923.07,643.16 L859.34,643.16 L859.34,722.86 L923.06,722.86 L926.05,722.84 L931.58,722.69 Z M1174.14,671.63 L1174.49,665.66 L1175.00,660.25 L1175.33,657.75 L1175.52,656.52 L1175.94,654.19 L1176.43,651.96 L1176.98,649.84 L1177.60,647.82 L1178.28,645.91 L1179.04,644.11 L1179.86,642.42 L1180.30,641.60 L1180.77,640.80 L1181.75,639.31 L1182.81,637.89 L1183.97,636.56 L1185.20,635.33 L1186.53,634.19 L1187.93,633.14 L1189.40,632.20 L1190.18,631.76 L1190.98,631.34 L1192.60,630.57 L1194.33,629.87 L1196.15,629.24 L1198.06,628.68 L1200.06,628.19 L1202.14,627.77 L1204.31,627.41 L1205.44,627.26 L1207.75,626.98 L1212.67,626.55 L1218.04,626.26 L1223.85,626.11 L1226.92,626.10 L1254.74,626.10 L1258.25,626.12 L1264.84,626.29 L1270.90,626.63 L1276.39,627.14 L1278.95,627.46 L1280.20,627.64 L1282.59,628.07 L1284.87,628.59 L1287.04,629.20 L1289.09,629.90 L1291.03,630.68 L1292.86,631.56 L1294.56,632.52 L1295.39,633.05 L1296.19,633.61 L1297.69,634.79 L1299.09,636.12 L1300.37,637.57 L1301.54,639.14 L1302.60,640.83 L1303.53,642.64 L1304.35,644.55 L1304.73,645.56 L1305.07,646.60 L1305.69,648.76 L1306.21,651.08 L1306.65,653.55 L1306.99,656.17 L1307.25,658.93 L1307.42,661.85 L1307.51,664.91 L1307.53,668.21 L1290.89,668.21 L1290.84,664.13 L1290.62,659.77 L1290.31,656.89 L1290.04,655.16 L1289.72,653.58 L1289.34,652.13 L1289.14,651.48 L1288.93,650.87 L1288.45,649.68 L1287.92,648.61 L1287.32,647.64 L1286.66,646.76 L1285.94,645.98 L1285.17,645.28 L1284.30,644.65 L1283.87,644.38 L1283.40,644.12 L1282.34,643.60 L1281.19,643.14 L1279.94,642.73 L1278.59,642.37 L1277.13,642.07 L1275.56,641.81 L1273.89,641.62 L1273.02,641.54 L1271.16,641.40 L1267.06,641.18 L1262.49,641.03 L1257.44,640.96 L1254.73,640.95 L1226.93,640.95 L1224.53,640.96 L1220.01,641.03 L1215.88,641.18 L1212.15,641.40 L1210.45,641.54 L1208.86,641.70 L1205.91,642.16 L1203.29,642.79 L1201.56,643.38 L1200.51,643.82 L1200.03,644.04 L1199.58,644.28 L1198.69,644.81 L1197.87,645.41 L1197.11,646.07 L1196.40,646.80 L1195.74,647.60 L1195.13,648.48 L1194.56,649.45 L1194.30,649.94 L1194.06,650.46 L1193.58,651.62 L1193.14,652.88 L1192.74,654.24 L1192.20,656.51 L1191.62,659.94 L1191.40,661.79 L1191.21,663.78 L1190.91,668.20 L1190.70,673.16 L1190.60,678.67 L1190.59,681.62 L1190.59,684.37 L1190.60,687.23 L1190.70,692.57 L1190.91,697.40 L1191.21,701.72 L1191.40,703.67 L1191.62,705.50 L1192.20,708.87 L1192.93,711.83 L1193.58,713.77 L1194.06,714.94 L1194.31,715.46 L1194.56,715.96 L1195.13,716.95 L1195.75,717.85 L1196.42,718.69 L1197.13,719.45 L1197.91,720.15 L1198.73,720.79 L1199.63,721.37 L1200.08,721.62 L1200.56,721.87 L1201.62,722.35 L1202.75,722.78 L1203.95,723.17 L1205.94,723.68 L1208.89,724.20 L1210.47,724.39 L1212.17,724.55 L1215.90,724.80 L1220.01,724.97 L1224.53,725.05 L1226.93,725.07 L1254.73,725.07 L1260.03,725.04 L1267.08,724.88 L1271.18,724.70 L1273.03,724.58 L1274.76,724.44 L1277.16,724.12 L1278.62,723.84 L1279.98,723.51 L1281.23,723.12 L1282.38,722.69 L1283.44,722.21 L1283.90,721.97 L1284.33,721.71 L1285.19,721.12 L1285.97,720.45 L1286.68,719.70 L1287.33,718.85 L1287.92,717.91 L1288.46,716.86 L1288.94,715.70 L1289.15,715.10 L1289.35,714.46 L1289.72,713.03 L1290.04,711.46 L1290.31,709.74 L1290.62,706.89 L1290.84,702.55 L1290.89,698.50 L1307.53,698.50 L1307.51,701.79 L1307.42,704.85 L1307.25,707.76 L1306.99,710.52 L1306.64,713.12 L1306.21,715.58 L1305.69,717.88 L1305.07,720.02 L1304.72,721.06 L1304.35,722.06 L1303.53,723.94 L1302.59,725.72 L1301.53,727.38 L1300.36,728.93 L1299.07,730.35 L1297.67,731.64 L1296.17,732.79 L1295.36,733.34 L1294.54,733.84 L1292.84,734.77 L1291.01,735.61 L1289.07,736.36 L1287.01,737.02 L1284.85,737.59 L1282.57,738.08 L1280.18,738.48 L1278.93,738.65 L1276.38,738.95 L1270.89,739.43 L1264.84,739.74 L1258.25,739.90 L1254.74,739.92 L1226.92,739.92 L1223.10,739.89 L1217.68,739.71 L1214.28,739.51 L1211.04,739.24 L1207.98,738.91 L1205.08,738.50 L1202.35,738.03 L1201.04,737.76 L1199.76,737.48 L1197.31,736.82 L1194.98,736.04 L1192.78,735.13 L1190.71,734.11 L1188.78,732.96 L1186.98,731.69 L1185.34,730.31 L1184.56,729.55 L1183.80,728.75 L1182.41,727.08 L1181.14,725.24 L1179.98,723.25 L1178.94,721.11 L1178.02,718.81 L1177.21,716.37 L1176.52,713.79 L1176.21,712.43 L1175.93,711.03 L1175.44,708.11 L1175.01,705.00 L1174.66,701.69 L1174.38,698.19 L1174.17,694.49 L1174.02,690.59 L1173.95,686.50 L1173.95,684.38 L1173.95,681.61 L1173.97,678.14 Z M1365.17,674.69 L1380.55,674.69 L1449.09,628.30 L1474.29,628.30 L1474.40,628.67 L1397.36,681.91 L1476.60,737.38 L1476.50,737.71 L1451.29,737.71 L1380.61,689.12 L1365.17,689.12 L1365.17,737.71 L1348.52,737.71 L1348.52,628.30 L1365.17,628.30 Z" fill="#0B0B0C" fill-rule="evenodd"/><path d="M1017.04,718.52 L1123.33,718.52 L1132.95,736.02 L1017.04,736.02 Z M1132.95,674.26 L1123.33,691.75 L1017.04,691.75 L1017.04,674.26 Z M1132.95,630.00 L1123.33,647.49 L1017.04,647.49 L1017.04,630.00 Z" fill="#EC8638" fill-rule="evenodd"/></svg>';
  var LOGO_STACKED_RATIO = 1627 / 856;
  var LOGO_HORIZONTAL_ON_DARK_SVG = LOGO_HORIZONTAL_SVG.replace(/#0B0B0C/g, "#FFFFFF");
  var LOGO_MARK_ON_DARK_SVG = LOGO_MARK_SVG.replace(/#0B0B0C/g, "#FFFFFF");
  var LOGO_STACKED_ON_DARK_SVG = LOGO_STACKED_SVG.replace(/#0B0B0C/g, "#FFFFFF");

  // ../../../ad-admin-spacing26/apps/admin/src/experience/Icon.tsx
  var import_jsx_runtime2 = __toESM(require_jsx_runtime());
  function Icon({ name, size = 20, color = "currentColor", uid = "" }) {
    const inner = (n) => uid ? iconInner(n).split(`#m${n}`).join(`#m${n}${uid}`).split(`id="m${n}"`).join(`id="m${n}${uid}"`) : iconInner(n);
    if (duotoneInner(name)) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { "aria-hidden": "true", width: size, height: size, viewBox: DUO_VIEWBOX, dangerouslySetInnerHTML: { __html: inner(name) } });
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { "aria-hidden": "true", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", dangerouslySetInnerHTML: { __html: inner(name) } });
  }

  // ../../../ad-admin-spacing26/apps/admin/src/experience/Ambient.tsx
  var import_jsx_runtime3 = __toESM(require_jsx_runtime());
  function Ambient({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "ax-ambient-root", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ax-ambient", "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ax-ambient-content", children })
    ] });
  }

  // ../../../ad-admin-spacing26/apps/admin/src/lib/backend-features.ts
  var NO_SHOW_REVIEW_ENABLED = false;
  var MEMBERSHIP_SETTLEMENT_ENABLED = true;
  var ADMIN_APPROVAL_REVIEW_ENABLED = true;
  var OFFLINE_RECEIPT_REGISTER_ENABLED = false;

  // ../../../ad-admin-spacing26/apps/admin/src/experience/nav.ts
  var SECTIONS = [
    { group: "Daily", key: "today", label: "Today", icon: "home", links: [{ href: "/dashboard", label: "Dashboard", office: true }] },
    { group: "Daily", key: "floor", label: "Floor", icon: "wrench", links: [{ href: "/jobs", label: "Jobs", office: false }, { href: "/bookings", label: "Bookings", office: false }, { href: "/service-quotes", label: "Service quotes", office: true }, { href: "/pickups", label: "Pickup and drop", office: true }, ...ADMIN_APPROVAL_REVIEW_ENABLED ? [{ href: "/office-requests", label: "Staff requests", office: true }] : [], { href: "/attendance", label: "Attendance", office: false }] },
    { group: "Daily", key: "people", label: "People", icon: "users", links: [{ href: "/customers", label: "Customers", office: true }, { href: "/staff", label: "Staff", office: true }, { href: "/vehicles", label: "Cars", office: true }, { href: "/papers", label: "Documents", office: true }, { href: "/memberships", label: "Memberships", office: true }] },
    { group: "Daily", key: "money", label: "Money", icon: "payments", links: [{ href: "/payments", label: "Payments", office: true }, { href: "/invoices", label: "Invoices", office: true }, { href: "/expenses", label: "Expenses", office: true }, { href: "/daily-close", label: "Day close", office: true }, { href: "/reports", label: "Reports", office: true }] },
    { group: "Grow", key: "marketing", label: "Marketing", icon: "star", links: [{ href: "/stories", label: "Stories", office: true }, { href: "/offers", label: "Offers", office: true }, { href: "/cars", label: "Cars for sale", office: true }] },
    { group: "Set up", key: "catalogue", label: "Catalogue", icon: "services", links: [{ href: "/services", label: "Pricing", office: true }, { href: "/inventory", label: "Inventory", office: true }] },
    { group: "Set up", key: "admin", label: "Studio and team", icon: "profile", links: [{ href: "/studio", label: "Studio setup", office: true }, { href: "/audit", label: "Audit log", office: true }] }
  ];
  var GROUPS = [
    { key: "today", label: "Today", icon: "home", links: [{ href: "/dashboard", label: "Dashboard" }], office: true },
    { key: "floor", label: "Floor", icon: "wrench", links: [{ href: "/jobs", label: "Jobs" }, { href: "/bookings", label: "Bookings" }, { href: "/pickups", label: "Pickup and drop" }, { href: "/attendance", label: "Attendance" }], office: false },
    { key: "people", label: "People", icon: "users", links: [{ href: "/customers", label: "Customers" }, { href: "/staff", label: "Staff" }, { href: "/vehicles", label: "Cars" }, { href: "/papers", label: "Documents" }, { href: "/memberships", label: "Memberships" }], office: true },
    { key: "money", label: "Money", icon: "payments", links: [{ href: "/payments", label: "Payments" }, { href: "/invoices", label: "Invoices" }, { href: "/expenses", label: "Expenses" }, { href: "/daily-close", label: "Day close" }, { href: "/reports", label: "Reports" }], office: true }
  ];
  var MORE_LINKS = [
    { href: "/papers", label: "Documents" },
    { href: "/inventory", label: "Inventory" },
    { href: "/services", label: "Services" },
    { href: "/studio", label: "Studio" },
    { href: "/stories", label: "Stories" },
    { href: "/offers", label: "Offers" },
    { href: "/cars", label: "Cars for sale" },
    { href: "/pickups", label: "Pickup and drop" },
    { href: "/audit", label: "Audit log" }
  ];

  // ../../../ad-admin-spacing26/apps/admin/src/experience/StaffShell.tsx
  var import_jsx_runtime4 = __toESM(require_jsx_runtime());
  var LINK_ICON = { "/services": "services", "/inventory": "tools", "/stories": "star", "/offers": "star", "/cars": "car", "/pickups": "car", "/staff": "users", "/studio": "pin", "/papers": "shield", "/audit": "search" };
  var RAIL_ICON = {
    "/dashboard": "home",
    "/bookings": "calendar",
    "/pickups": "pickup",
    "/jobs": "wrench",
    "/attendance": "check-in",
    "/customers": "users",
    "/vehicles": "garage",
    "/memberships": "membership",
    "/payments": "payments",
    "/invoices": "invoice",
    "/expenses": "check-out",
    "/daily-close": "check",
    "/reports": "inspect",
    "/services": "services",
    "/inventory": "tools",
    "/stories": "star",
    "/cars": "car",
    "/staff": "profile",
    "/studio": "pin",
    "/papers": "shield",
    "/audit": "search"
  };
  var ROLE_LABEL = {
    admin: "Owner",
    studio: "Studio",
    superadmin: "Platform"
  };
  function isActive(pathname, href) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  function StaffShell({ pathname, office, role: role2, who, home, onSignOut, children }) {
    const link = (l) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      Link,
      {
        href: l.href,
        className: "ax-nav-link",
        title: l.label,
        "aria-label": l.label,
        "aria-current": isActive(pathname, l.href) ? "page" : void 0,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: RAIL_ICON[l.href] ?? "dot", size: 22, uid: "-rail" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ax-nav-text", children: l.label })
        ]
      },
      l.href
    );
    const [moreOpen, setMoreOpen] = (0, import_react.useState)(false);
    const sheet = (0, import_react.useRef)(null);
    (0, import_react.useEffect)(() => {
      setMoreOpen(false);
    }, [pathname]);
    (0, import_react.useEffect)(() => {
      if (!moreOpen) return;
      const previous = document.activeElement;
      sheet.current?.querySelector("button,a")?.focus();
      const key = (e) => {
        if (e.key === "Escape") {
          setMoreOpen(false);
          return;
        }
        if (e.key !== "Tab") return;
        const controls = Array.from(sheet.current?.querySelectorAll("a,button") ?? []);
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      };
      document.addEventListener("keydown", key);
      return () => {
        document.removeEventListener("keydown", key);
        previous?.focus();
      };
    }, [moreOpen]);
    const groups = GROUPS.filter((g) => office || !g.office);
    const activeGroup = groups.find((g) => g.links.some((l) => isActive(pathname, l.href)));
    const moreActive = !activeGroup && MORE_LINKS.some((l) => isActive(pathname, l.href));
    const sections = SECTIONS.map((sec) => ({ ...sec, links: sec.links.filter((l) => office || !l.office) })).filter((sec) => sec.links.length > 0);
    const activeSection = sections.find((sec) => sec.links.some((l) => isActive(pathname, l.href)));
    const moreSections = sections;
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "ax-shell", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Ambient, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ax-shell-frame", "data-hero": pathname === "/dashboard" ? "on" : void 0, children: [
      pathname === "/dashboard" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "ax-herobg", "aria-hidden": "true" }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Link, { href: home, className: "ax-corner ax-corner--l", "aria-label": "AutoDeck home", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { className: "ax-lg ax-lg--full ax-lg-l", src: logoDataUri(LOGO_HORIZONTAL_SVG), alt: "AutoDeck" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { className: "ax-lg ax-lg--full ax-lg-d", src: logoDataUri(LOGO_HORIZONTAL_ON_DARK_SVG), alt: "", "aria-hidden": "true" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { className: "ax-lg ax-lg--mark ax-lg-l", src: logoDataUri(LOGO_MARK_SVG), alt: "", "aria-hidden": "true" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { className: "ax-lg ax-lg--mark ax-lg-d", src: logoDataUri(LOGO_MARK_ON_DARK_SVG), alt: "", "aria-hidden": "true" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ax-corner ax-corner--r", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PushAlertsButton, {}),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ax-avatar", title: `${who} - ${ROLE_LABEL[role2] ?? role2}`, "aria-label": `${who}, ${ROLE_LABEL[role2] ?? role2}`, children: (who.trim()[0] ?? "A").toUpperCase() }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "ax-corner-out", title: "Sign out", "aria-label": "Sign out", onClick: onSignOut, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { "aria-hidden": "true", width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("polyline", { points: "16 17 21 12 16 7" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("line", { x1: "21", y1: "12", x2: "9", y2: "12" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ax-corner-out-t", children: "Sign out" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("aside", { className: "ax-side", "aria-label": "Main navigation", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "ax-side-scroll", children: sections.map((sec, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("nav", { className: "ax-nav-group", "aria-label": sec.label, "data-tier": sec.group === "Daily" ? "1" : sec.group === "Grow" ? "2" : "3", "data-first": i === 0 || sections[i - 1].group !== sec.group ? "1" : void 0, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Link, { href: sec.links[0].href, className: "ax-nav-link", title: sec.label, "aria-label": sec.label, "aria-current": activeSection?.key === sec.key ? "page" : void 0, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: sec.icon, size: 22, uid: "-rail" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ax-nav-text", children: sec.label })
      ] }) }, sec.key)) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("main", { className: "ax-main", children: [
        activeSection && activeSection.links.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("nav", { className: "ax-subtabs", "aria-label": activeSection.label, children: activeSection.links.map((l) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Link, { href: l.href, className: "ax-subtab", "aria-current": isActive(pathname, l.href) ? "page" : void 0, children: l.label }, l.href)) }) : null,
        children
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("nav", { className: "ax-tabbar", "aria-label": "Main", children: [
        groups.map((g) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Link, { href: g.links[0].href, className: "ax-tab", "aria-label": g.label, title: g.label, "aria-current": activeGroup?.key === g.key ? "page" : void 0, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: g.icon, size: 24 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: g.label })
        ] }, g.key)),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "ax-tab", "aria-label": "Menu", title: "Menu", "aria-current": moreActive || moreOpen ? "page" : void 0, onClick: () => setMoreOpen((v) => !v), children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { "aria-hidden": "true", width: "24", height: "24", viewBox: "0 0 24 24", fill: "currentColor", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "5", cy: "12", r: "1.8" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "12", cy: "12", r: "1.8" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "19", cy: "12", r: "1.8" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "Menu" })
        ] })
      ] }),
      moreOpen ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "ax-sheet-back", onClick: () => setMoreOpen(false), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { ref: sheet, className: "ax-sheet", role: "dialog", "aria-modal": "true", "aria-label": "Menu", onClick: (e) => e.stopPropagation(), children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "ax-button", style: { alignSelf: "flex-end" }, onClick: () => setMoreOpen(false), children: "Close" }),
        moreSections.map((sec) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "ax-label", children: sec.label }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "ax-sheet-grid", children: sec.links.map((l) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Link, { href: l.href, className: "ax-sheet-link", "aria-current": isActive(pathname, l.href) ? "page" : void 0, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: RAIL_ICON[l.href] ?? LINK_ICON[l.href] ?? "dot", size: 18 }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: l.label })
          ] }, l.href)) })
        ] }, sec.key)),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ax-sheet-foot", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
            who,
            " \xB7 ",
            ROLE_LABEL[role2] ?? role2
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "ax-button", onClick: onSignOut, children: "Sign out" })
        ] })
      ] }) }) : null
    ] }) }) });
  }

  // ../../../ad-admin-spacing26/apps/admin/src/components/OfflineReceiptPanel.tsx
  var import_react2 = __toESM(require_react());

  // pixel-job27/functions.ts
  var httpsCallable = () => async () => {
    window.__writes = (window.__writes ?? 0) + 1;
    throw Error("No writes in preview");
  };

  // ../../../ad-admin-spacing26/apps/admin/src/components/OfflineReceiptPanel.tsx
  init_firebase();

  // pixel-job27/data.ts
  var p = new URLSearchParams(location.search);
  var role = p.get("role") === "studio" ? "studio" : "admin";
  var mode = p.get("mode") ?? "paid";
  var stage = p.get("stage") ?? "READY_FOR_DELIVERY";
  var pb = { basePrice: 9e4, scopeAdjustment: 0, addOns: [], membershipDiscount: null, subtotal: 9e4, tax: 0, taxDescription: "Tax", total: 9e4 };
  var job = { id: "SAMPLE-JOB", tenantId: "SAMPLE-TENANT", studioId: "SAMPLE-STUDIO", customerId: "SAMPLE-CUSTOMER", vehicleId: "SAMPLE-CAR", serviceId: "SAMPLE-SERVICE", bookingId: "SAMPLE-BOOKING", bayId: "bay", scheduledAt: "2026-11-09T04:30:00Z", estimatedEndAt: "2026-11-09T05:30:00Z", scheduledDate: "2026-11-09", estimatedEndDate: "2026-11-09", estimatedDurationMinutes: 60, status: stage, statusHistory: [{ status: "PENDING_VEHICLE", changedAt: "2026-11-09T03:00:00Z" }, { status: "VEHICLE_RECEIVED", changedAt: "2026-11-09T04:00:00Z" }, { status: stage, changedAt: "2026-11-09T05:00:00Z" }], paymentStatus: mode === "paid" ? "paid" : "unpaid", totalAmount: 9e4, additionalWorkDelta: 0, priceBreakdown: pb, createdAt: "2026-11-09T03:00:00Z" };
  var booking = { id: "SAMPLE-BOOKING", tenantId: "SAMPLE-TENANT", studioId: "SAMPLE-STUDIO", customerId: "SAMPLE-CUSTOMER", vehicleId: "SAMPLE-CAR", serviceId: "SAMPLE-SERVICE", status: "CONFIRMED", scheduledDate: "2026-11-09", scheduledAt: job.scheduledAt, estimatedEndAt: job.estimatedEndAt, durationMinutes: 60, rescheduleCount: 0, priceBreakdown: pb, totalAmount: 9e4 };
  var payment = mode === "unpaid" ? null : { id: "SAMPLE-PAYMENT", tenantId: "SAMPLE-TENANT", jobId: job.id, method: mode === "pending" ? "razorpay_payment_link" : "cash", status: mode === "pending" ? "pending" : "completed", amount: 9e4, ...mode === "review" ? { invoiceReviewNeeded: true } : {} };
  var invoice = mode === "paid" ? { id: "SAMPLE-INVOICE", jobId: job.id, tenantId: job.tenantId, invoiceNumber: "SAMPLE-001", status: "paid" } : null;
  var customer = { id: "SAMPLE-CUSTOMER", name: "Sample customer", phone: "9999999999" };
  var vehicle = { id: "SAMPLE-CAR", registrationNumber: "SAMPLE001", make: "Sample", model: "Car" };
  var service = { id: "SAMPLE-SERVICE", name: "Sample headlight buffing" };

  // pixel-job27/auth.ts
  var useAdminAuth = () => ({ loading: false, user: { uid: "SAMPLE-STAFF" }, claims: { tenantId: "SAMPLE-TENANT", studioId: "SAMPLE-STUDIO", role } });

  // ../../../ad-admin-spacing26/apps/admin/src/lib/format.ts
  function formatPaise(paise) {
    if (typeof paise !== "number" || !Number.isFinite(paise)) return "-";
    return `\u20B9${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 === 0 ? 0 : 2, maximumFractionDigits: paise % 100 === 0 ? 0 : 2 })}`;
  }
  function formatDateTime(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  }
  function formatDate(iso) {
    if (!iso) return "-";
    const value = iso.length === 10 ? `${iso}T12:00:00Z` : iso;
    return new Date(value).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }
  function formatTime(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?(AM|PM)$/i, (m) => ` ${m.trim().toLowerCase()}`);
  }
  function formatDayLong(day) {
    return (/* @__PURE__ */ new Date(`${day}T12:00:00Z`)).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      day: "numeric",
      month: "short"
    });
  }

  // ../../../ad-admin-spacing26/apps/admin/src/components/OfflineReceiptPanel.tsx
  var import_jsx_runtime5 = __toESM(require_jsx_runtime());
  function OfflineReceiptPanel({ jobId }) {
    const { user, claims } = useAdminAuth();
    const scope = [jobId, user?.uid, claims?.tenantId, claims?.role].join("|");
    const liveScope = (0, import_react2.useRef)(scope);
    liveScope.current = scope;
    const generation = (0, import_react2.useRef)(0), lock = (0, import_react2.useRef)(false);
    const key = (0, import_react2.useRef)(null);
    const [resolved, setResolved] = (0, import_react2.useState)("");
    const [review, setReview] = (0, import_react2.useState)(null), [error, setError] = (0, import_react2.useState)(null);
    const [busy, setBusy] = (0, import_react2.useState)(false), [amount, setAmount] = (0, import_react2.useState)(""), [method, setMethod] = (0, import_react2.useState)("cash"), [reference, setReference] = (0, import_react2.useState)("");
    const [verified, setVerified] = (0, import_react2.useState)(false), [note, setNote] = (0, import_react2.useState)(""), [returnMethod, setReturnMethod] = (0, import_react2.useState)("cash");
    const allowed = !!user && ["admin", "superadmin"].includes(claims?.role ?? "");
    const current = review && resolved === scope && allowed ? review : null;
    async function load() {
      const expected = scope, n = generation.current;
      try {
        const result = await httpsCallable(functions, "getOfflineReceiptReview")({ jobId });
        if (liveScope.current !== expected || generation.current !== n) return;
        setReview(result.data);
        setResolved(expected);
        setError(null);
      } catch (e) {
        if (liveScope.current === expected && generation.current === n) {
          setReview(null);
          setResolved("");
          setError(e instanceof Error ? e.message : "Could not load receipts.");
        }
      }
    }
    (0, import_react2.useEffect)(() => {
      generation.current++;
      lock.current = false;
      key.current = null;
      setReview(null);
      setResolved("");
      setError(null);
      setBusy(false);
      setAmount("");
      setReference("");
      setVerified(false);
      setNote("");
      setMethod("cash");
      if (allowed) void load();
      return () => {
        generation.current++;
      };
    }, [scope, allowed]);
    async function record() {
      if (!current || current.cancelled || current.balanceDuePaise <= 0 || !verified || lock.current || liveScope.current !== scope) return;
      const receivedPaise = Math.round(Number(amount) * 100);
      if (!/^\d+(?:\.\d{1,2})?$/.test(amount.trim()) || !Number.isSafeInteger(receivedPaise) || receivedPaise <= 0) {
        setError("Enter the amount actually received.");
        return;
      }
      const intent = JSON.stringify([scope, receivedPaise, method, reference.trim()]);
      if (key.current && key.current.intent !== intent) {
        setError("The previous receipt outcome is unresolved. Retry its original amount, method and reference, or check the register before starting a different receipt.");
        return;
      }
      if (!key.current) key.current = { intent, key: crypto.randomUUID() };
      const expected = scope, n = generation.current;
      lock.current = true;
      setBusy(true);
      try {
        await httpsCallable(functions, "recordOfflineReceipt")({ jobId, receiptKey: key.current.key, receivedPaise, method, reference: reference.trim() });
        if (liveScope.current !== expected || generation.current !== n) return;
        key.current = null;
        setAmount("");
        setVerified(false);
        await load();
      } catch (e) {
        if (liveScope.current === expected && generation.current === n) setError(e instanceof Error ? e.message : "Receipt outcome unknown. Retry the same receipt, not a second collection.");
      } finally {
        if (liveScope.current === expected && generation.current === n) {
          lock.current = false;
          setBusy(false);
        }
      }
    }
    async function returned(receiptId) {
      if (!current || lock.current || note.trim().length < 3 || liveScope.current !== scope) return;
      const obligation = current.obligations.find((o) => o.id === receiptId && o.status === "due" && o.amountPaise > 0 && o.amountPaise <= current.officeReturnDuePaise);
      if (!obligation) return;
      const expected = scope, n = generation.current;
      lock.current = true;
      setBusy(true);
      try {
        await httpsCallable(functions, "settleOfflineReturn")({ receiptId, note: note.trim(), method: returnMethod });
        if (liveScope.current !== expected || generation.current !== n) return;
        setNote("");
        await load();
      } catch (e) {
        if (liveScope.current === expected && generation.current === n) setError(e instanceof Error ? e.message : "Could not record return.");
      } finally {
        if (liveScope.current === expected && generation.current === n) {
          lock.current = false;
          setBusy(false);
        }
      }
    }
    if (!allowed) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "ax-panel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "ax-label", children: "Actual offline receipts" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "ax-note", children: "Record verified money only. Part payment leaves a balance. Excess is returned by the office, never as automatic credit or refund." }),
      error && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { role: "alert", children: error }),
      current ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        current.cancelled && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "ax-note", children: "Visit cancelled. A return remains owed until the office records the actual return." }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "Balance due" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: formatPaise(current.balanceDuePaise) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "Total office return due" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: formatPaise(current.officeReturnDuePaise) })
        ] }),
        current.receipts.map((r) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { className: "ax-note", children: [
          r.createdAt,
          " - ",
          r.method,
          " - received ",
          formatPaise(r.receivedPaise),
          ", applied ",
          formatPaise(r.appliedPaise),
          ", excess ",
          formatPaise(r.officeReturnDuePaise)
        ] }, r.id)),
        current.balanceDuePaise > 0 && !current.cancelled && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "ax-form-row", children: [
            "Actual amount received (Rs)",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { "aria-label": "Actual amount received", value: amount, inputMode: "decimal", onChange: (e) => setAmount(e.target.value) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "ax-form-row", children: [
            "Method",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("select", { value: method, onChange: (e) => setMethod(e.target.value), children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "cash", children: "Cash" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "upi_manual", children: "UPI verified by office" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "bank_transfer", children: "Bank transfer verified by office" })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "ax-form-row", children: [
            "Reference",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { value: reference, onChange: (e) => setReference(e.target.value) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "checkbox", checked: verified, onChange: (e) => setVerified(e.target.checked) }),
            " I checked the actual money received."
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { className: "ax-button", disabled: busy || !verified, onClick: () => void record(), children: "Record actual receipt" })
        ] }),
        current.officeReturnDuePaise > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "ax-note", children: "Office only: record a return after the money has actually been handed back. This does not send money." }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "ax-form-row", children: [
            "Actual return method",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("select", { value: returnMethod, onChange: (e) => setReturnMethod(e.target.value), children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "cash", children: "Cash" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "upi_manual", children: "UPI" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "bank_transfer", children: "Bank transfer" })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "ax-form-row", children: [
            "Return reference or evidence note",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { "aria-label": "Return evidence note", value: note, onChange: (e) => setNote(e.target.value) })
          ] }),
          current.obligations.filter((o) => o.status === "due" && o.amountPaise > 0 && o.amountPaise <= current.officeReturnDuePaise).map((o) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { className: "ax-button", disabled: busy || note.trim().length < 3, onClick: () => void returned(o.id), children: [
            o.kind === "cancellation" ? "Record cancellation return" : "Record excess return",
            ": ",
            formatPaise(o.amountPaise)
          ] }, o.id))
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "Loading receipt register." }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { className: "ax-button", disabled: busy, onClick: () => void load(), children: "Refresh receipts" })
    ] });
  }

  // ../../../ad-admin-spacing26/apps/admin/src/components/MembershipSettlement.tsx
  var import_react3 = __toESM(require_react());
  init_firebase();
  var import_jsx_runtime6 = __toESM(require_jsx_runtime());
  function MembershipSettlement({
    job: job2,
    booking: booking2
  }) {
    const [busy, setBusy] = (0, import_react3.useState)(false), [error, setError] = (0, import_react3.useState)(null);
    if (!MEMBERSHIP_SETTLEMENT_ENABLED) return null;
    if (job2.settlementKind === "membership_covered" || !booking2?.membershipWashUsed || booking2.totalAmount !== 0 || job2.totalAmount !== 0 || job2.status === "CANCELLED" || ["CANCELLED", "EXPIRED"].includes(booking2.status))
      return null;
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "ax-panel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "ax-label", children: "Membership-covered, not yet settled" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "ax-note", children: "The server checks the consumed wash and issues the zero-total invoice. This does not record money received." }),
      error ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { role: "alert", children: error }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "button",
        {
          className: "ax-button",
          disabled: busy,
          onClick: () => {
            setBusy(true);
            setError(null);
            void httpsCallable(
              functions,
              "settleMembershipCoveredJob"
            )({ jobId: job2.id }).catch((e) => setError(e instanceof Error ? e.message : "Could not settle this visit.")).finally(() => setBusy(false));
          },
          children: "Settle membership-covered visit"
        }
      )
    ] });
  }

  // ../../packages/core/src/car-segments.ts
  var CAR_SEGMENTS = [
    { value: "hatchback", label: "Hatchback" },
    { value: "sedan", label: "Sedan" },
    { value: "suv", label: "SUV" },
    { value: "van", label: "MUV / XUV" }
  ];
  var STAFF_SEGMENTS = [
    ...CAR_SEGMENTS,
    { value: "commercial", label: "Commercial" }
  ];

  // ../../packages/core/src/menu.ts
  var COVERAGE_LEVELS = [
    { key: "high_impact", label: "High-impact kit", blurb: "Bonnet, bumper, mirrors and the panels that take stone chips." },
    { key: "full_front", label: "Full front", blurb: "Bonnet, bumper, fenders, mirrors and headlights." },
    { key: "full_body", label: "Full body", blurb: "Every painted panel." }
  ];
  var wash = (id, name, rupees, minutes, description, order) => ({ id: `menu-wash-${id}`, name, group: "wash", category: "washing", brand: null, description, rupees, minutes, bay: "wash", order });
  var coat = (id, name, brand, rupees, years2, description, order, placeholder = false) => ({
    id: `menu-coat-${id}`,
    name,
    group: "coatings",
    category: "ceramic",
    brand,
    description,
    rupees,
    minutes: 480,
    bay: "protection",
    order,
    placeholder,
    ...years2 ? { warrantyLabel: `${years2}-year coating warranty`, warrantyYears: years2 } : {}
  });
  var addon = (id, name, rupees, description, order) => ({ id: `menu-coat-${id}`, name, group: "coatings", category: "coating", brand: "Add-ons", description, rupees, minutes: 120, bay: "protection", order, placeholder: true });
  var ppf = (brand, level, rupees, minutes, years2, order) => {
    const label2 = COVERAGE_LEVELS.find((c) => c.key === level)?.label ?? level;
    return {
      id: `menu-ppf-${brand.toLowerCase()}-${level.replace("_", "-")}`,
      name: `${brand} ${label2}`,
      group: "ppf",
      category: "ppf",
      brand,
      description: `${brand} paint protection film, ${label2.toLowerCase()} coverage.`,
      rupees,
      minutes,
      bay: "protection",
      coverageLevel: level,
      priceFrom: level === "full_body",
      warrantyLabel: `${years2}-year film warranty`,
      warrantyYears: years2,
      order
    };
  };
  var MENU_SEED = [
    // Wash & Care
    wash("foam", "Foam wash", 900, 60, "Foam wash, rinse and dry.", 10),
    wash("exterior", "Exterior detail wash", 1500, 90, "Detailed exterior wash with wheels, tyres and door shuts.", 20),
    wash("interior", "Interior deep clean", 4500, 180, "Vacuum, steam clean and conditioning of seats, mats and trim.", 30),
    wash("full", "Full detail wash", 5750, 300, "Interior deep clean and exterior detail wash together.", 40),
    // Coatings by brand
    coat("autodeck-1", "AutoDeck Care Ceramic 1-year", "AutoDeck Care", 1e4, 1, "Entry ceramic coating for daily cars.", 100, true),
    coat("autodeck-2", "AutoDeck Care Ceramic 2-year", "AutoDeck Care", 14e3, 2, "Entry ceramic coating, two-year protection.", 110, true),
    coat("fireball-1", "Fireball 1-year", "Fireball", 12e3, 1, "Fireball ceramic coating, one-year tier.", 120),
    coat("fireball-2", "Fireball 2-year", "Fireball", 16e3, 2, "Fireball ceramic coating, two-year tier.", 130),
    coat("fireball-3", "Fireball 3-year", "Fireball", 2e4, 3, "Fireball ceramic coating, three-year tier.", 140),
    coat("kovalent-prolong", "Kovalent Prolong", "Kovalent", 22e3, null, "Kovalent Prolong ceramic coating.\n- 9H ceramic with heat resistance and a brilliant finish\n- Where used: Paint", 150, true),
    coat("kovalent-graphene", "Kovalent Graphene", "Kovalent", 32e3, null, "Kovalent graphene coating.", 160),
    coat("kovalent-borophene", "Kovalent Borophene", "Kovalent", 5e4, null, "Kovalent Borophene coating on Boron Nitride technology\n- 9H+ hardness and 10-micron film with extreme gloss, on Boron Nitride technology\n- Where used: Paint\n- Brand rating: 9 years durability (manufacturer claim; not an AutoDeck warranty)", 170),
    coat("3m-ceramic", "3M Ceramic Coating", "3M", 45e3, null, "3M ceramic coating.", 180, true),
    // Surface add-ons (pre-quoted, editable)
    addon("glass", "Glass coating", 4e3, "Hydrophobic coating for all glass.", 200),
    addon("wheels", "Wheel coating", 5e3, "Ceramic coating for wheel faces and barrels.", 210),
    addon("leather", "Leather coating", 6e3, "Protective coating for leather seats and trim.", 220),
    addon("fabric", "Fabric coating", 5e3, "Stain-repellent coating for fabric seats and mats.", 230),
    addon("trim", "Trim restore and coat", 3500, "Restores faded plastic trim and seals it.", 240),
    // PPF by brand then coverage (Garware 8-year, XPEL and LLumar 10-year, 3M 10-year per brand pages already in the app)
    ppf("Garware", "high_impact", 15e3, 1440, 8, 300),
    ppf("Garware", "full_front", 4e4, 1440, 8, 310),
    ppf("Garware", "full_body", 75e3, 2880, 8, 320),
    ppf("XPEL", "high_impact", 25e3, 1440, 10, 330),
    ppf("XPEL", "full_front", 8e4, 1440, 10, 340),
    ppf("XPEL", "full_body", 13e4, 2880, 10, 350),
    ppf("LLumar", "high_impact", 22e3, 1440, 10, 360),
    ppf("LLumar", "full_front", 7e4, 1440, 10, 370),
    ppf("LLumar", "full_body", 11e4, 2880, 10, 380),
    ppf("3M", "high_impact", 22e3, 1440, 10, 390),
    ppf("3M", "full_front", 65e3, 1440, 10, 400),
    ppf("3M", "full_body", 1e5, 2880, 10, 410),
    { id: "menu-ppf-colour", name: "Colour and black PPF", group: "ppf", category: "ppf", brand: "Colour films", description: "Coloured, black and satin films. Priced after we see the car.", rupees: 0, consult: true, minutes: 2880, bay: "protection", order: 420 },
    // Garage: published health checks, rest by inspection
    { id: "menu-garage-inspection", name: "Multi-point inspection", group: "garage", category: "garage", brand: null, description: "Paint, body, underbody, tyres, brakes and fluids checked and reported.", rupees: 1e3, minutes: 60, bay: "general", placeholder: true, order: 500 },
    { id: "menu-garage-alignment", name: "Wheel alignment and balancing", group: "garage", category: "garage", brand: null, description: "Four-wheel alignment and balancing.", rupees: 1500, minutes: 90, bay: "general", placeholder: true, order: 510 },
    { id: "menu-garage-ac", name: "AC check", group: "garage", category: "garage", brand: null, description: "Cooling performance, gas level and leak check.", rupees: 800, minutes: 45, bay: "general", placeholder: true, order: 520 },
    { id: "menu-garage-battery", name: "Battery check", group: "garage", category: "garage", brand: null, description: "Battery health, terminals and charging system test.", rupees: 500, minutes: 30, bay: "general", placeholder: true, order: 530 },
    { id: "menu-garage-repairs", name: "Repairs and other work (book an inspection)", group: "garage", category: "garage", brand: null, description: "Tell us what is wrong. We inspect the car and quote the work.", rupees: 0, consult: true, minutes: 60, bay: "general", order: 540 },
    // Modifications and wraps: consult only
    { id: "menu-mods-tint", name: "Window tint", group: "mods", category: "modifications", brand: null, description: "Heat-rejecting window films. Quoted by car and film.", rupees: 0, consult: true, minutes: 180, bay: "general", order: 600 },
    { id: "menu-mods-wrap", name: "Vinyl wraps and colour change", group: "mods", category: "modifications", brand: null, description: "Full and partial wraps. Quoted after seeing the car.", rupees: 0, consult: true, minutes: 2880, bay: "general", order: 610 },
    { id: "menu-mods-styling", name: "Accessories and styling", group: "mods", category: "modifications", brand: null, description: "Accessories and styling work, quoted per job.", rupees: 0, consult: true, minutes: 120, bay: "general", order: 620 },
    // Pickup and drop
    { id: "menu-pickup", name: "Pickup and drop", group: "pickup", category: "pickup", brand: null, description: "We collect your car and bring it back. Flat rate within the city.", rupees: 500, minutes: 60, bay: "general", placeholder: true, order: 700 }
  ];

  // ../../packages/core/src/pickup-zone.ts
  var PICKUP_FREE_ROAD_METERS = 3e3;
  var PICKUP_TILE_TEXT = `Free up to ${PICKUP_FREE_ROAD_METERS / 1e3} km`;

  // ../../packages/core/src/intent-key.ts
  function intentKey(current, next, makeKey) {
    if (current && current.intent === next) return current;
    return { intent: next, key: makeKey() };
  }

  // ../../packages/core/src/gift.ts
  var GIFT_VALID_DAYS = 60;
  var GIFT_TERMS = {
    validity: `Valid for ${GIFT_VALID_DAYS} days from the day you buy it. It expires after that and cannot be extended.`,
    nonRefundable: "Gifts cannot be refunded, exchanged for cash or transferred after payment.",
    oneWash: "One foam wash for any car. One use only."
  };

  // ../../packages/core/src/duration.ts
  function formatDuration(minutes) {
    const m = Math.max(0, Math.round(minutes));
    if (m < 60) return `${m} min${m === 1 ? "" : "s"}`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r === 0 ? `${h} hr` : `${h} hr ${r} min${r === 1 ? "" : "s"}`;
  }

  // ../../packages/core/src/settlement-display.ts
  function membershipCoveredLabel(v) {
    return v.settlementKind === "membership_covered" ? "Membership-covered" : v.membershipWashUsed && v.totalAmount === 0 ? "Membership-covered, not yet settled" : null;
  }

  // ../../packages/core/src/protection-declaration.ts
  function targetableRecords(protections) {
    return protections.filter((p2) => (p2.lifecycle ?? "current") === "current" && (p2.kind === "ppf" || p2.kind === "ceramic"));
  }
  function newInstallDraft() {
    return { action: "install", kind: null, coverage: null, brand: "", warrantyYears: "" };
  }
  function newReplaceDraft() {
    return { action: "replace", targetProtectionId: null, expectedRevision: null, brand: "", warrantyYears: "" };
  }
  function newRemoveDraft() {
    return { action: "remove", targetProtectionId: null, expectedRevision: null };
  }
  function selectTarget(draft, target) {
    return { ...draft, targetProtectionId: target.id, expectedRevision: target.revision ?? 0 };
  }
  var years = (raw) => {
    const t = raw.trim();
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isInteger(n) || n < 0 || n > 30) return "invalid";
    return n;
  };
  function buildProtectionWork(draft, protections) {
    if (draft.choice === null) return null;
    if (draft.choice === "none") return [];
    if (draft.events.length === 0) return null;
    const targets = new Map(targetableRecords(protections).map((p2) => [p2.id, p2]));
    const events = [];
    const seenTargets = /* @__PURE__ */ new Set();
    for (const ev of draft.events) {
      if (ev.action === "install") {
        if (ev.kind === null || ev.coverage === null) return null;
        const wy2 = years(ev.warrantyYears);
        if (wy2 === "invalid") return null;
        events.push({ action: "install", kind: ev.kind, coverage: ev.coverage, brand: ev.brand.trim() || null, warrantyYears: wy2 });
        continue;
      }
      if (!ev.targetProtectionId) return null;
      const target = targets.get(ev.targetProtectionId);
      if (!target) return null;
      if (seenTargets.has(target.id)) return null;
      seenTargets.add(target.id);
      if (ev.expectedRevision === null || (target.revision ?? 0) !== ev.expectedRevision) return null;
      if (ev.action === "remove") {
        events.push({ action: "remove", targetProtectionId: target.id, expectedRevision: ev.expectedRevision });
        continue;
      }
      const wy = years(ev.warrantyYears);
      if (wy === "invalid") return null;
      if (target.coverage === null || target.coverage === void 0 || target.kind !== "ppf" && target.kind !== "ceramic") return null;
      events.push({
        action: "replace",
        targetProtectionId: target.id,
        expectedRevision: ev.expectedRevision,
        kind: target.kind,
        coverage: target.coverage,
        brand: ev.brand.trim() || null,
        warrantyYears: wy
      });
    }
    return events;
  }

  // ../../packages/core/src/customer-offering-visibility.json
  var customer_offering_visibility_default = {
    confirmedProductIds: [
      "menu-coat-kovalent-borophene",
      "svc_3eefcd920146c12bf2964e0039caf527",
      "svc-brand-kovalent-overlay",
      "svc_1ad8f59de1f7c3d007793e2d869877f7",
      "svc-brand-kovalent-fabric",
      "svc_d69177dc7c13d6c282ea2e37f4918e39",
      "svc-brand-kovalent-glass",
      "svc-brand-fireball-butterfly-graphene",
      "menu-coat-kovalent-graphene",
      "svc-brand-kovalent-graphene-matrix",
      "svc_7c799caa1e4d2560b37825cd050a107b",
      "svc_fd82917361ed1bbcac06ae7a0d3e256d",
      "svc_3597c0cf6b6f78d91f3b2e2d20a33cbb",
      "svc-brand-kovalent-restore",
      "svc_4bc5f0044af09d09d75b68f7f9359b0b",
      "svc_3cb92db2a8f130f0bc3a114bf5cd801f",
      "svc_c2ad7236d8a3a5cacfd1027321fe03a3",
      "svc_b25d851d8e5d7dd89e73f357459bd05d",
      "svc_bb4445b597ce369d1b175058d57999b8",
      "svc-brand-fireball-aegis",
      "svc-brand-fireball-butterfly",
      "svc-brand-fireball-devil-s-blood",
      "svc-brand-fireball-dok-do",
      "svc_9bb6e3363a1fc8747fd235fa6214dd62",
      "svc_756528e7af66f6d68f1686847869aa0b",
      "svc_5ee55b18b30dc42f74320d26b5869b31",
      "svc-brand-fireball-silla",
      "svc_bbf57c519b93c33dd538b8e62c72f7ec",
      "svc_b9af5e32252e73b32ccfbd240e629bdb",
      "svc_39328bdbf0d7309bcd1348c26ee13a1a",
      "svc_81d1a5eef928b0408b41cce3d4d4b2ad",
      "svc_f8fea2cba9e0397a45cb644656bd67e8",
      "svc-brand-kovalent-matte",
      "menu-coat-kovalent-prolong",
      "svc-brand-kovalent-prolong-light",
      "svc_fa4f7a7d3c7d4bdd5d73e05b9949fd75",
      "svc_8fe3c734573024265ba900a29310ca30",
      "svc_73695dabf44d93b9ebd5cd9024ee028d",
      "svc_54cd856b406ee1215117530ad9b401bf",
      "svc-brand-fireball-talon",
      "svc_99e574e6bba8de8f0f43e8db06c0b893",
      "svc_7cf3a05184a39da790c1f3f8325bda5a"
    ],
    ordinaryServiceIds: [
      "svc-wash-regular",
      "svc-wash-premium",
      "svc-wash-detail-spa",
      "svc-wash-headlight-buffing",
      "svc-coating-teflon",
      "svc-coating-maintenance",
      "menu-wash-exterior",
      "menu-wash-interior",
      "menu-wash-full",
      "menu-coat-glass",
      "menu-coat-wheels",
      "menu-coat-leather",
      "menu-coat-fabric",
      "menu-coat-trim",
      "menu-garage-inspection",
      "menu-garage-alignment",
      "menu-garage-ac",
      "menu-garage-battery",
      "menu-garage-repairs",
      "menu-mods-tint",
      "menu-mods-wrap",
      "menu-mods-styling",
      "menu-pickup"
    ],
    confirmedEnquiryKeys: [
      "koch-chemie-ceramic-allround-c0-02",
      "koch-chemie-ceramic-body-cb0-01",
      "koch-chemie-ceramic-neo-c0-03",
      "koch-chemie-ceramic-rims-cr0-01",
      "kovalent-fabric",
      "kovalent-matrix",
      "kovalent-matte",
      "kovalent-overlay",
      "kovalent-prolong-light",
      "pps-spray",
      "llumar-ppf",
      "garware-ppf",
      "xpel-ppf",
      "avery-dennison-ppf",
      "avvyx-ppf",
      "nar-ppf",
      "gswf-ppf",
      "rodim-ppf"
    ]
  };

  // ../../packages/core/src/customer-offering-visibility.ts
  var visibleIds = /* @__PURE__ */ new Set([...customer_offering_visibility_default.confirmedProductIds, ...customer_offering_visibility_default.ordinaryServiceIds]);
  var enquiryKeys = new Set(customer_offering_visibility_default.confirmedEnquiryKeys);

  // ../../../ad-admin-spacing26/apps/admin/src/lib/payment-panel-state.ts
  function paymentPanelMode(payment2) {
    if (payment2 === void 0) return "loading";
    return payment2 === null ? "none" : "present";
  }
  function canOfferPayment(payment2, jobPaymentStatus) {
    if (payment2 === void 0 || jobPaymentStatus !== "unpaid") return { link: false, counter: false };
    return { link: payment2 === null || payment2.status === "failed" || payment2.status === "cancelled", counter: payment2 === null || payment2.status === "failed" || payment2.status === "cancelled" };
  }
  function coveredVisitSettlementNote(job2, booking2) {
    const unsettled = (v) => !!v && v.settlementKind !== "membership_covered" && v.membershipWashUsed === true && v.totalAmount === 0;
    if (!unsettled(job2) && !unsettled(booking2)) return null;
    if (MEMBERSHIP_SETTLEMENT_ENABLED) return null;
    return "Membership-covered visit - nothing to collect here. Settle it in the studio app: open the job, Record cash payment for Rs 0.";
  }
  function coveredSettlePanelVisible(job2, booking2) {
    if (!MEMBERSHIP_SETTLEMENT_ENABLED) return false;
    if (!job2 || !booking2) return false;
    if (job2.settlementKind === "membership_covered") return false;
    if (booking2.membershipWashUsed !== true) return false;
    if (booking2.totalAmount !== 0 || job2.totalAmount !== 0) return false;
    if (job2.status === "CANCELLED" || booking2.status === "CANCELLED" || booking2.status === "EXPIRED") return false;
    return true;
  }

  // ../../../ad-admin-spacing26/apps/admin/src/lib/status-tone.ts
  var STATUS_TONES = {
    PENDING: "warning",
    CONFIRMED: "accent",
    ACTIVE: "accent",
    COMPLETED: "success",
    CANCELLED: "neutral",
    EXPIRED: "neutral",
    STANDBY: "warning",
    PENDING_VEHICLE: "warning",
    VEHICLE_RECEIVED: "accent",
    IN_PROGRESS: "accent",
    QUALITY_CHECK: "warning",
    READY_FOR_DELIVERY: "success",
    DELIVERED: "success",
    pending: "warning",
    processing: "accent",
    completed: "success",
    failed: "error",
    cancelled: "neutral",
    refunded: "neutral",
    draft: "neutral",
    issued: "accent",
    paid: "success",
    unpaid: "warning",
    partial: "warning",
    NO_SHOW: "error",
    MISSED: "warning",
    void: "neutral",
    active: "success",
    expired: "neutral",
    verified: "success",
    unverified: "warning",
    approved: "success",
    rejected: "error"
  };
  function statusTone(status) {
    return STATUS_TONES[status] ?? "neutral";
  }

  // ../../../ad-admin-spacing26/apps/admin/src/lib/status-label.ts
  var LABELS = {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    ACTIVE: "Active",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
    NO_SHOW: "No-show",
    MISSED: "Missed",
    STANDBY: "Arrived - standby",
    PENDING_VEHICLE: "Awaiting vehicle",
    VEHICLE_RECEIVED: "Checked in",
    IN_PROGRESS: "In progress",
    QUALITY_CHECK: "Quality check",
    READY_FOR_DELIVERY: "Ready for pickup",
    DELIVERED: "Delivered",
    pending: "Pending",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
    refunded: "Refunded",
    partial: "Part paid",
    unpaid: "Unpaid",
    paid: "Paid",
    draft: "Draft",
    issued: "Issued",
    void: "Void",
    active: "Active",
    expired: "Expired",
    verified: "Verified",
    unverified: "Unverified",
    approved: "Approved",
    rejected: "Declined"
  };
  function statusLabel(value) {
    if (!value) return "-";
    const known = LABELS[value];
    if (known) return known;
    const words = value.replace(/[_-]+/g, " ").trim().toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  // ../../../ad-admin-spacing26/apps/admin/src/components/StatusBadge.tsx
  var import_jsx_runtime7 = __toESM(require_jsx_runtime());
  function StatusBadge({ label: label2, tone }) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: `badge badge-${tone ?? statusTone(label2)}`, title: label2, children: statusLabel(label2) });
  }

  // ../../../ad-admin-spacing26/apps/admin/src/components/JobPaymentPanel.tsx
  var import_jsx_runtime8 = __toESM(require_jsx_runtime());
  var METHOD_LABEL = { cash: "Cash", upi_manual: "UPI", bank_transfer: "Bank transfer", razorpay_payment_link: "Online (Razorpay)" };
  function JobPaymentPanel({
    job: job2,
    compact = false,
    booking: booking2,
    payment: payment2,
    invoice: invoice2,
    customer: customer2,
    status,
    setStatus,
    method,
    setMethod,
    reference,
    setReference,
    linking,
    recording,
    confirming,
    onCreateLink,
    onRecordPayment,
    onConfirmCashPayment,
    onOpenInvoice,
    onRefreshPayment
  }) {
    async function copyLink(url) {
      try {
        await navigator.clipboard.writeText(url);
        setStatus("Link copied.");
      } catch {
        setStatus("Could not copy. Select the link and copy it.");
      }
    }
    function whatsappHref(url) {
      const digits = (customer2?.phone ?? "").replace(/\D/g, "");
      const first = (customer2?.name ?? "").split(" ")[0] || "there";
      const text = `Hi ${first}, here is your AutoDeck bill of ${formatPaise(job2.totalAmount)}. Pay securely: ${url}`;
      return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
    }
    if (job2.offlineSettlement && job2.paymentStatus !== "paid") return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("section", { className: "ax-panel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "ax-label", children: "Offline receipt balance" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ax-note", children: "Actual receipts already exist. Use the receipt register to record only new money actually received. Do not collect or record the full invoice total again." }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "kv", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "Balance due" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: formatPaise(job2.status === "CANCELLED" ? 0 : Math.max(0, job2.totalAmount - job2.offlineSettlement.appliedPaise)) })
      ] })
    ] });
    if (coveredSettlePanelVisible(job2, booking2)) return null;
    const settled = compact && job2.paymentStatus === "paid" && payment2?.status === "completed" && !payment2.invoiceReviewNeeded;
    const Panel = settled ? "details" : "section";
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Panel, { className: "ax-panel ax-job-payment", children: [
      settled ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("summary", { children: "Payment details \xB7 Paid" }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "ax-label", children: "Payment" }),
      payment2?.status === "completed" && job2.paymentStatus !== "paid" && !payment2.invoiceReviewNeeded ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ax-note", children: "Payment records are syncing. Do not collect another payment. Delivery stays on hold until the job is marked paid." }) : null,
      status && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ax-status-msg", role: "status", children: status }),
      paymentPanelMode(payment2) === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ax-note", style: { marginTop: 0 }, children: "Loading payment\u2026" }) : payment2 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: METHOD_LABEL[payment2.method] ?? statusLabel(payment2.method) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(StatusBadge, { label: payment2.invoiceReviewNeeded ? "Received - needs review" : payment2.status === "completed" && job2.paymentStatus !== "paid" ? "Payment records syncing" : payment2.status }) })
        ] }),
        payment2.invoiceReviewNeeded ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ax-note", children: "Money received, but this payment needs office review. The job is not marked paid. Do not collect another payment." }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "Amount" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "ax-data", children: formatPaise(payment2.amount) })
        ] }),
        (payment2.status === "pending" || payment2.status === "processing") && (payment2.method === "razorpay_payment_link" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ax-note", children: "Payment link pending. No payment is confirmed in AutoDeck yet." }),
          onRefreshPayment ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "ax-button", onClick: onRefreshPayment, children: "Refresh recorded payment status" }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ax-note", children: "Counter collection is on hold while this online link is pending. A safe switch is not available here yet. Do not record or collect a second payment." }),
          payment2.paymentUrl && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ax-panel-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "ax-button", onClick: () => void copyLink(payment2.paymentUrl), children: "Copy link" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("a", { className: "ax-button ax-button--primary", href: whatsappHref(payment2.paymentUrl), target: "_blank", rel: "noreferrer", children: "Send on WhatsApp" })
          ] })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "ax-panel-actions", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "ax-button ax-button--primary", onClick: () => void onConfirmCashPayment(), disabled: confirming, children: confirming ? "Confirming\u2026" : "Confirm money received" }) }))
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ax-note", style: { marginTop: 0 }, children: membershipCoveredLabel(job2) ?? (booking2 ? membershipCoveredLabel(booking2) : null) ?? "No payment started yet." }),
      invoice2 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
            "Invoice ",
            invoice2.invoiceNumber
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(StatusBadge, { label: invoice2.status }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "ax-panel-actions", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "ax-button", onClick: () => onOpenInvoice(invoice2.id), children: "Open invoice" }) })
      ] }),
      coveredVisitSettlementNote(job2, booking2) ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ax-note", style: { marginTop: 8 }, children: coveredVisitSettlementNote(job2, booking2) }) : null,
      !(booking2?.cancelIntent?.state === "waiting" || booking2?.cancelIntent?.state === "needs_review") && !membershipCoveredLabel(job2) && !(booking2 && membershipCoveredLabel(booking2)) && canOfferPayment(payment2, job2.paymentStatus).link && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "ax-panel-actions", style: { marginTop: 12 }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "ax-button ax-button--primary", style: { width: "100%" }, onClick: () => void onCreateLink(), disabled: linking, children: linking ? "Creating link\u2026" : `Send ${formatPaise(job2.totalAmount)} payment link` }) }),
      !(booking2?.cancelIntent?.state === "waiting" || booking2?.cancelIntent?.state === "needs_review") && !membershipCoveredLabel(job2) && !(booking2 && membershipCoveredLabel(booking2)) && canOfferPayment(payment2, job2.paymentStatus).counter && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--ad-border-subtle)" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ax-label", style: { margin: "0 0 12px" }, children: "Record a payment taken at the counter" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { className: "ax-form-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "ax-label", children: "Method" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("select", { value: method, onChange: (e) => setMethod(e.target.value), children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "cash", children: "Cash" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "upi_manual", children: "UPI" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "bank_transfer", children: "Bank transfer" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { className: "ax-form-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "ax-label", children: "Reference (optional)" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { value: reference, onChange: (e) => setReference(e.target.value), placeholder: "UPI or transfer reference" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "ax-button ax-button--primary", style: { width: "100%" }, onClick: () => void onRecordPayment(), disabled: recording, children: recording ? "Recording\u2026" : `Record ${formatPaise(job2.totalAmount)} received` })
      ] })
    ] });
  }

  // ../../../ad-admin-spacing26/apps/admin/src/lib/job-activity-label.ts
  var labels = { "job.created": "Job opened", "job.status_changed": "Job stage updated", "job.bay_assigned": "Bay assigned", "job.staff_assigned": "Staff assigned", "payment.initiated": "Payment started", "payment.completed": "Payment received", "payment.failed": "Payment failed", "invoice.issued": "Invoice issued", "approval.created": "Extra work approval requested", "approval.approved": "Extra work approved", "approval.rejected": "Extra work declined" };
  function jobActivityLabel(action) {
    if (labels[action]) return labels[action];
    const text = action.replace(/[._-]+/g, " ").trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // ../../../ad-admin-spacing26/apps/admin/src/lib/go-back.ts
  var KEY = "ax-page-views";
  var tabStore = () => {
    try {
      return typeof window === "undefined" ? null : window.sessionStorage;
    } catch {
      return null;
    }
  };
  var RETURNING = "ax-returning";
  function goBackOrTo(router, fallback, store = tabStore()) {
    if (store) store.setItem(RETURNING, "1");
    const views = store ? Number(store.getItem(KEY)) || 0 : 0;
    if (views > 1) router.back();
    else router.push(fallback);
  }

  // ../../../ad-admin-spacing26/apps/admin/src/app/(admin)/jobs/[id]/page.tsx
  var import_react9 = __toESM(require_react());

  // pixel-job27/nav.ts
  var useParams = () => ({ id: "SAMPLE-JOB" });
  var useRouter = () => ({ push: (href) => document.body.dataset.open = href, back: () => {
  }, replace: () => {
  } });

  // ../../../ad-admin-spacing26/apps/admin/src/app/(admin)/jobs/[id]/page.tsx
  init_firebase();

  // pixel-job27/jobs.ts
  var stop = () => {
  };
  var listenToJob = (_id, cb) => {
    cb(job);
    return stop;
  };
  var getWarrantyForJob = async () => null;
  var listenToAuditForEntity = (_t, _kind, _id, cb) => {
    cb([]);
    return stop;
  };
  var listenToInspectionForJob = (_id, cb) => {
    cb({ status: "finalized", finalizedAt: "2026-11-09T04:00:00Z", checklist: [{ area: "exterior", key: "lamp", label: "Headlights", rating: "good" }], overallNotes: "Sample inspection notes retained." });
    return stop;
  };

  // pixel-job27/bookings.ts
  var stop2 = () => {
  };
  var listenToBooking = (_id, cb) => {
    cb(booking);
    return stop2;
  };
  var listenToApprovalsForJob = (_id, _t, cb) => {
    cb([]);
    return stop2;
  };
  var listenToPaymentForJob = (_id, _t, cb) => {
    cb(payment);
    return stop2;
  };
  var listenToInvoiceForJob = (_id, _t, cb) => {
    cb(invoice);
    return stop2;
  };
  var getCustomer = async () => customer;
  var getVehicle = async () => vehicle;
  var getService = async () => service;
  var reject = async () => {
    throw Error("No changes in preview");
  };
  var setBookingQuote = reject;
  var decideBookingRescheduleRequest = reject;
  var adminCancelBooking = reject;
  var settleCancellationFee = reject;
  var settleManualRefund = reject;
  var getNoShowResolution = reject;
  var recordNoShowContact = reject;
  var previewNoShowResolution = reject;
  var resolveNoShow = reject;

  // pixel-job27/studio.ts
  var getStudioConfig = async () => ({ bays: [{ id: "bay", name: "Sample bay" }] });

  // ../../../ad-admin-spacing26/apps/admin/src/components/BookingPanels.tsx
  var import_react6 = __toESM(require_react());

  // ../../../ad-admin-spacing26/apps/admin/src/lib/refund-owed-copy.ts
  function refundOwedText(paise) {
    return `Refund owed ${formatPaise(paise)}, not yet returned. Give it back to the customer by hand; the system has not sent anything.`;
  }

  // ../../../ad-admin-spacing26/apps/admin/src/components/CancelBookingPanel.tsx
  var import_react4 = __toESM(require_react());

  // pixel-job27/firestore.ts
  var doc = (...a) => ({ id: a.at(-1) });
  var collection = (...a) => a;
  var query = (...a) => a;
  var where = (...a) => a;
  var limit = (...a) => a;
  var getDocs = async () => ({ docs: [], empty: true });
  var getDoc = async () => ({ exists: () => false, data: () => void 0 });

  // ../../packages/database/src/collections.ts
  var COLLECTIONS = {
    tenants: () => "tenants",
    /** First-party RUM beacons from the web apps. Server only (default-deny rules); never read by clients. */
    webVitals: () => "webVitals",
    customers: () => "customers",
    vehicles: () => "vehicles",
    // Tombstones for permanently deleted cars (doc id == old vehicleId); Cloud Functions write only.
    deletedVehicles: () => "deletedVehicles",
    bookings: () => "bookings",
    pickupRequests: () => "pickupRequests",
    // Server-only pickup fee quotes (getPickupQuote): default-deny rules, never read by clients.
    pickupQuotes: () => "pickupQuotes",
    // Server-only monthly routing-call counters (kill-switch). Default-deny rules.
    routingUsage: () => "routingUsage",
    accountDeletionRequests: () => "accountDeletionRequests",
    jobs: () => "jobs",
    approvals: () => "approvals",
    // Staff-to-admin approval requests (distinct from customer additional-work approvals)
    adminApprovalRequests: () => "adminApprovalRequests",
    payments: () => "payments",
    // Staff-only attention items (reason code + references, no customer data). Cloud Function writes only.
    staffAlerts: () => "staffAlerts",
    invoices: () => "invoices",
    warranties: () => "warranties",
    // inspections/{jobId} — one per job (id == jobId), same pattern as warranties
    inspections: () => "inspections",
    memberships: () => "memberships",
    membershipPlans: () => "membershipPlans",
    services: () => "services",
    employees: () => "employees",
    attendance: () => "attendance",
    // staffAccessRequests/{uid} - a signed-in person asking the admin for studio access
    staffAccessRequests: () => "staffAccessRequests",
    expenses: () => "expenses",
    inventoryItems: () => "inventoryItems",
    inventoryTxns: () => "inventoryTxns",
    papers: () => "papers",
    dailyClosings: () => "dailyClosings",
    gallery: () => "gallery",
    stories: () => "stories",
    offers: () => "offers",
    jobMessages: () => "jobMessages",
    /** Gift-a-wash codes (hashed). Server only; rules deny all client access. */
    gifts: () => "gifts",
    /** Failed gift-code attempts per account and per network address, for the lockout. Server only. */
    giftAttempts: () => "giftAttempts",
    /** Server only (default-deny rules): the plain gift code, so a buyer who closed the app after paying can get it again. */
    giftSecrets: () => "giftSecrets",
    /** Server only (default-deny rules): one in-flight gift purchase per buyer, serializes concurrent createGift calls. */
    giftPurchaseSlots: () => "giftPurchaseSlots",
    carListings: () => "carListings",
    carLeads: () => "carLeads",
    studioConfig: () => "studioConfig",
    // Recovery snapshots written by purgeTestBookings BEFORE any test-data delete: full JSON of every removed doc. Server only.
    cleanupSnapshots: () => "cleanupSnapshots",
    auditLog: () => "auditLog",
    notifications: () => "notifications",
    // reviews/{bookingId} — one customer rating per completed booking (Cloud Function write only)
    reviews: () => "reviews",
    bookingIntents: () => "bookingIntents",
    // invoiceCounters/{tenantId} — atomic invoice number counter (Admin SDK only)
    invoiceCounters: () => "invoiceCounters",
    // paymentEvents/{providerEventId} — idempotency guard for webhook/event deduplication
    // refundRequests/{requestId} — booking refund outbox: reservation -> provider -> projection
    refundRequests: () => "refundRequests",
    // paymentRefunds/pr_<paymentId>_<providerRefundId> — durable per-refund
    // identity ledger: one doc per provider refund, written transactionally
    // with its projection so the same refund can never be counted twice
    // across webhook event types, duplicate deliveries, or code paths.
    paymentRefunds: () => "paymentRefunds",
    paymentEvents: () => "paymentEvents",
    // shopRateLimits/{hashedKey} — shared abuse-limiter windows (server only)
    shopRateLimits: () => "shopRateLimits",
    // rateLimits/{tenantId__uid__action} — server-only fixed-window abuse counters
    rateLimits: () => "rateLimits",
    // bayLocks/{tenantId__studioId__bayId} — server-only deterministic-document
    // touch used to give Firestore's transaction conflict detection a
    // document-version-based signal for bay-assignment races. Firestore
    // transactions do NOT reliably detect a "phantom" conflict from a QUERY
    // whose result set changes due to a concurrent transaction's write
    // (confirmed empirically, Phase 7 hostile audit) — reading and writing a
    // query result alone is not sufficient to serialize two concurrent
    // callers racing for the same bay. Reading+writing this specific document
    // measurably reduces (empirically: ~50%→~10-15% failure rate under
    // adversarial back-to-back stress testing) that race, but does NOT fully
    // eliminate it — repeated stress-testing still shows occasional
    // double-assignment. This is a KNOWN, OPEN, documented gap requiring a
    // proper claim/lock document with a real lifecycle as follow-up work, not
    // a complete fix. See createBooking.ts's usage and the corresponding test
    // file comments for the full account. Never read directly for any other
    // purpose — it carries no meaningful data, only a version.
    bayLocks: () => "bayLocks"
  };
  var SUBCOLLECTIONS = {
    membershipUsage: (membershipId) => `memberships/${membershipId}/usage`,
    // jobPhotos: deferred capability (Phase 3F/3H audit) — job.statusHistory[]
    // is the embedded-array successor to the old jobStatusHistory subcollection
    // design, which has been removed; jobPhotos has no superseding mechanism
    // and is kept as the reserved path for that still-unbuilt capability.
    jobPhotos: (jobId) => `jobs/${jobId}/photos`,
    vehicleProtections: (vehicleId) => `vehicles/${vehicleId}/protections`
  };

  // ../../../ad-admin-spacing26/apps/admin/src/components/CancelBookingPanel.tsx
  var import_jsx_runtime9 = __toESM(require_jsx_runtime());
  var CANCELLABLE = ["PENDING_VEHICLE", "STANDBY", "VEHICLE_RECEIVED"];
  function CancelBookingPanel({ booking: booking2, job: job2, compact = false }) {
    const [reason, setReason] = (0, import_react4.useState)("");
    const [feeAction, setFeeAction] = (0, import_react4.useState)("charge");
    const [preview, setPreview] = (0, import_react4.useState)(null);
    const [busy, setBusy] = (0, import_react4.useState)(false);
    const [msg, setMsg] = (0, import_react4.useState)(null);
    const [warn, setWarn] = (0, import_react4.useState)(null);
    const [settleNote, setSettleNote] = (0, import_react4.useState)("");
    async function findOwedPaymentId() {
      const { db: db2 } = await Promise.resolve().then(() => (init_firebase(), firebase_exports));
      const snap = await getDocs(query(collection(db2, COLLECTIONS.payments()), where("bookingId", "==", booking2.id), where("status", "==", "completed"), limit(10)));
      const manual = snap.docs.map((d) => d.data()).find((x) => x.method !== "razorpay_payment_link");
      if (!manual) throw new Error("No completed cash/UPI/bank payment found for this booking.");
      return manual.id;
    }
    const settleBlock = /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("label", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "How was the money returned" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("input", { value: settleNote, onChange: (e) => setSettleNote(e.target.value), placeholder: "e.g. handed back at the counter", maxLength: 500 })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "ax-row", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("button", { className: "ax-button ax-button--primary", disabled: busy || settleNote.trim().length < 3, onClick: () => run(async () => {
        const pid = await findOwedPaymentId();
        await settleManualRefund(pid, settleNote.trim());
      }, () => setMsg("Refund marked as returned. The owed amount is cleared.")), children: "Mark refund returned" }) })
    ] });
    const cancelled = booking2.status === "CANCELLED";
    const closed = cancelled || booking2.status === "COMPLETED" || booking2.status === "EXPIRED";
    const started = !!job2 && !CANCELLABLE.includes(job2.status);
    async function run(fn, done) {
      setBusy(true);
      setWarn(null);
      setMsg(null);
      try {
        done(await fn());
      } catch (e) {
        setWarn(e instanceof Error ? e.message : "That did not work.");
      } finally {
        setBusy(false);
      }
    }
    if (booking2.cancelIntent?.state === "waiting" || booking2.cancelIntent?.state === "needs_review") return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("section", { className: "ax-panel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "ax-label", children: "Cancellation requested" }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("p", { className: "ax-note", children: [
        "Your booked time is still held while the online payment resolves. The booking is not cancelled yet.",
        booking2.cancelIntent.state === "needs_review" ? " A payment may still be in progress or arrive. The booking stays held and cancels by itself, with a refund reserved, if one does. Check the payment in the Razorpay dashboard." : ""
      ] })
    ] });
    if (cancelled) {
      const owed = typeof booking2.manualRefundDuePaise === "number" && booking2.manualRefundDuePaise > 0 ? booking2.manualRefundDuePaise : 0;
      if (!(booking2.cancellationFeePaise && booking2.cancellationFeePaise > 0)) {
        return owed > 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("section", { className: "ax-panel", "data-testid": "refund-owed", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "ax-label", children: "Refund owed" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "ax-note", children: refundOwedText(owed) }),
          settleBlock,
          msg ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "ax-status-msg", children: msg }) : null,
          warn ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "ax-status-msg ax-status-msg--warn", role: "alert", children: warn }) : null
        ] }) : null;
      }
      const st = booking2.cancellationFeeStatus;
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("section", { className: "ax-panel", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "ax-label", children: "Cancellation fee" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "Fee" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: formatPaise(booking2.cancellationFeePaise) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "Status" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: st === "due" ? "Due" : st === "collected" ? "Collected" : st === "withheld" ? "Kept from the refund" : st === "waived" ? "Waived" : "Due" })
        ] }),
        owed > 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "ax-note", "data-testid": "refund-owed", children: refundOwedText(owed) }) : null,
        owed > 0 ? settleBlock : null,
        typeof booking2.refundedPaise === "number" && booking2.refundedPaise > 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "Refunded" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: formatPaise(booking2.refundedPaise) })
        ] }) : null,
        !st || st === "due" ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "ax-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("button", { className: "ax-button ax-button--primary", disabled: busy, onClick: () => run(() => settleCancellationFee(booking2.id, "collected"), () => setMsg("Marked as collected.")), children: "Mark fee collected" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("button", { className: "ax-button", disabled: busy, onClick: () => run(() => settleCancellationFee(booking2.id, "waived"), () => setMsg("Fee waived.")), children: "Waive fee" })
        ] }) : null,
        msg ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "ax-status-msg", children: msg }) : null,
        warn ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "ax-status-msg ax-status-msg--warn", role: "alert", children: warn }) : null
      ] });
    }
    if (closed) return null;
    if (compact && started) return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("details", { className: "ax-panel ax-job-disclosure", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("summary", { children: "Cancellation unavailable" }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "ax-status-msg", children: "Work has started on this job, so it cannot be cancelled from here." })
    ] });
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("section", { className: "ax-panel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "ax-label", children: "Cancel booking" }),
      started ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "ax-status-msg", children: "Work has started on this job, so it cannot be cancelled from here." }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "Reason" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("input", { value: reason, onChange: (e) => {
            setReason(e.target.value);
            setPreview(null);
          }, placeholder: "Why is it being cancelled", maxLength: 500 })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "Cancellation fee" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("select", { value: feeAction, onChange: (e) => {
            setFeeAction(e.target.value);
            setPreview(null);
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("option", { value: "charge", children: "Customer asked: apply the policy fee" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("option", { value: "waive", children: "Studio cancelled: no fee" })
          ] })
        ] }),
        !preview ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "button",
          {
            className: "ax-button",
            disabled: busy || reason.trim().length < 3,
            onClick: () => run(() => adminCancelBooking({ bookingId: booking2.id, reason: reason.trim(), feeAction, preview: true }), setPreview),
            children: "Review"
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "Paid" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: formatPaise(preview.paidPaise) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "Fee" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { children: [
              formatPaise(preview.feePaise),
              preview.feeStatus === "due" ? " (due, nothing paid yet)" : ""
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "Refund to customer" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: formatPaise(preview.refundPaise) })
          ] }),
          preview.refundPaise > 0 && preview.method !== "razorpay_payment_link" ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("p", { className: "ax-status-msg", children: [
            "This was not paid online. Give the ",
            formatPaise(preview.refundPaise),
            " back by hand."
          ] }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "ax-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "button",
              {
                className: "ax-button ax-button--danger",
                disabled: busy,
                onClick: () => run(() => adminCancelBooking({ bookingId: booking2.id, reason: reason.trim(), feeAction }), () => setMsg("Booking cancelled.")),
                children: "Confirm cancel"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("button", { className: "ax-button", disabled: busy, onClick: () => setPreview(null), children: "Back" })
          ] })
        ] })
      ] }),
      msg ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "ax-status-msg", children: msg }) : null,
      warn ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "ax-status-msg ax-status-msg--warn", role: "alert", children: warn }) : null
    ] });
  }

  // ../../../ad-admin-spacing26/apps/admin/src/components/NoShowPanel.tsx
  var import_react5 = __toESM(require_react());
  var import_jsx_runtime10 = __toESM(require_jsx_runtime());
  var CHANNELS = [
    { key: "phone", label: "Phone call" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "in_person", label: "In person" }
  ];
  var REFUND_STATE_LABEL = {
    reserved: "Queued, not yet sent to the payment provider",
    submitted: "Sent to the payment provider, waiting for confirmation",
    accepted: "Accepted by the payment provider, settlement not confirmed",
    ambiguous: "Unclear at the payment provider - needs a manual check",
    projected: "Accepted by the payment provider, recorded in the books",
    failed: "Failed - needs attention"
  };
  function ResolvedNoShow({ bookingId, fallbackResolution }) {
    const [state, setState] = (0, import_react5.useState)(null);
    const [loadFailed, setLoadFailed] = (0, import_react5.useState)(false);
    (0, import_react5.useEffect)(() => {
      let live = true;
      getNoShowResolution(bookingId).then((v) => {
        if (live) setState(v);
      }).catch(() => {
        if (live) setLoadFailed(true);
      });
      return () => {
        live = false;
      };
    }, [bookingId]);
    const resolution = state?.resolution ?? fallbackResolution;
    const chargePaise = state?.chargePaise ?? 0;
    const hasRefundRequest = Boolean(state?.refundRequestId);
    const refundText = !state ? "Checking the refund status..." : loadFailed || hasRefundRequest && state.refundStatus === null ? "Refund recorded; status unavailable right now." : null;
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("section", { className: "ax-panel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "ax-label", children: "No-show" }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "kv", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: "Resolution" }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: resolution })
      ] }),
      resolution === "charge" ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "kv", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: "Charge kept" }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "ax-data", children: formatPaise(chargePaise) })
      ] }) : null,
      state && hasRefundRequest && state.refundStatus !== null ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "kv", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: "Refund" }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { children: [
          state.refundAmountPaise !== null ? `${formatPaise(state.refundAmountPaise)} - ` : "",
          REFUND_STATE_LABEL[state.refundStatus] ?? "Status unavailable right now."
        ] })
      ] }) : null,
      refundText && (hasRefundRequest || !state) ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "kv", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: "Refund" }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: refundText })
      ] }) : null
    ] });
  }
  function NoShowPanel({ booking: booking2, onError }) {
    const [preview, setPreview] = (0, import_react5.useState)(null);
    const [picked, setPicked] = (0, import_react5.useState)(null);
    const [reason, setReason] = (0, import_react5.useState)("");
    const [note, setNote] = (0, import_react5.useState)("");
    const [channel, setChannel] = (0, import_react5.useState)("phone");
    const [busy, setBusy] = (0, import_react5.useState)(false);
    const [done, setDone] = (0, import_react5.useState)(null);
    const resolved = booking2.noShowResolution;
    const contactLog = booking2.noShowContactLog ?? [];
    (0, import_react5.useEffect)(() => {
      if (resolved) return;
      previewNoShowResolution(booking2.id).then(setPreview).catch((e) => onError(e instanceof Error ? e.message : "Could not load the no-show preview."));
    }, [booking2.id, resolved, onError]);
    async function saveContact() {
      setBusy(true);
      try {
        await recordNoShowContact(booking2.id, channel, note.trim());
        setNote("");
        onError(null);
        window.location.reload();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not record the contact.");
      } finally {
        setBusy(false);
      }
    }
    async function confirm() {
      if (!preview || !picked) return;
      const candidate = preview.candidates.find((c) => c.key === picked);
      if (!candidate) return;
      setBusy(true);
      try {
        await resolveNoShow({
          bookingId: booking2.id,
          resolution: candidate.key === "waive" ? "waive" : "charge",
          chargePaise: candidate.chargePaise,
          reason: reason.trim()
        });
        setDone("No-show resolved. The refund is queued, not yet sent to the payment provider.");
        onError(null);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not resolve the no-show.");
      } finally {
        setBusy(false);
      }
    }
    if (resolved) return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ResolvedNoShow, { bookingId: booking2.id, fallbackResolution: resolved });
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("section", { className: "ax-panel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "ax-label", children: "No-show review" }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("p", { className: "ax-note", children: [
        "The customer never arrived and the booking was auto-cancelled at studio close. Record how you tried to reach them, then decide the charge. ",
        preview?.policyNote
      ] }),
      contactLog.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { display: "grid", gap: 4, margin: "8px 0" }, children: contactLog.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("p", { className: "ax-note", children: [
        new Date(c.at).toLocaleString("en-IN"),
        " \xB7 ",
        c.channel,
        " \xB7 ",
        c.note
      ] }, i)) }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "ax-note", children: "No contact recorded yet." }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("select", { className: "ax-input", style: { width: "auto" }, value: channel, onChange: (e) => setChannel(e.target.value), children: CHANNELS.map((c) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("option", { value: c.key, children: c.label }, c.key)) }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("input", { className: "ax-input", style: { flex: 1, minWidth: 180 }, placeholder: "What was said?", value: note, onChange: (e) => setNote(e.target.value) }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { type: "button", className: "ax-button", disabled: busy || note.trim().length < 3, onClick: () => void saveContact(), children: "Record contact" })
      ] }),
      done ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { role: "status", children: done }) : preview ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "grid", gap: 8, marginTop: 12 }, children: [
        preview.capturedPaise === 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "ax-note", children: "No online payment was captured, so there is nothing to refund." }) : null,
        preview.candidates.map((c) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("button", { type: "button", className: picked === c.key ? "ax-button ax-button--primary" : "ax-button", "aria-pressed": picked === c.key, disabled: busy, onClick: () => setPicked(c.key), children: [
          c.key === "flat_rs100" ? "Charge Rs 100" : c.key === "pct_20" ? "Charge 20%" : "Waive the charge",
          ": keep ",
          formatPaise(c.chargePaise),
          ", refund ",
          formatPaise(c.refundPaise)
        ] }, c.key)),
        picked ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("input", { className: "ax-input", placeholder: "Reason for this decision (required)", value: reason, onChange: (e) => setReason(e.target.value) }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { type: "button", className: "ax-button ax-button--primary", disabled: busy || reason.trim().length < 3, onClick: () => void confirm(), children: "Confirm resolution" })
        ] }) : null
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { role: "status", children: "Loading the resolution options..." })
    ] });
  }

  // ../../../ad-admin-spacing26/apps/admin/src/components/BookingPanels.tsx
  var import_jsx_runtime11 = __toESM(require_jsx_runtime());
  function BookingPanels({ booking: booking2, job: job2, service: service2, bayName, onError, compact = false }) {
    const setError = onError;
    const pb2 = booking2.priceBreakdown;
    const [quoteRupees, setQuoteRupees] = (0, import_react6.useState)("");
    const [decisionBusy, setDecisionBusy] = (0, import_react6.useState)(false);
    const [decisionNote, setDecisionNote] = (0, import_react6.useState)("");
    const decisionKeyRef = (0, import_react6.useRef)(null);
    const bookingRef = (0, import_react6.useRef)(booking2.id);
    bookingRef.current = booking2.id;
    const decisionLock = (0, import_react6.useRef)(false), decisionGeneration = (0, import_react6.useRef)(0);
    (0, import_react6.useEffect)(() => {
      decisionGeneration.current++;
      decisionLock.current = false;
      setDecisionBusy(false);
      setDecisionNote("");
      decisionKeyRef.current = null;
      return () => {
        decisionGeneration.current++;
      };
    }, [booking2.id]);
    async function decide(approve) {
      if (!booking2 || decisionBusy || decisionLock.current || bookingRef.current !== booking2.id || booking2.rescheduleRequest?.status !== "pending") return;
      decisionLock.current = true;
      const generation = decisionGeneration.current, scope = booking2.id;
      const current = () => decisionGeneration.current === generation && bookingRef.current === scope;
      setDecisionBusy(true);
      try {
        decisionKeyRef.current = intentKey(decisionKeyRef.current, `${booking2.id}:${approve ? "approve" : "decline"}:${decisionNote.trim()}`, () => crypto.randomUUID());
        await decideBookingRescheduleRequest(booking2.id, approve, decisionKeyRef.current.key, decisionNote.trim() || void 0);
        if (!current()) return;
        setError(null);
        decisionKeyRef.current = null;
        window.location.reload();
      } catch (e) {
        if (current()) setError(e instanceof Error ? e.message : "Could not record the decision.");
      } finally {
        if (current()) {
          decisionLock.current = false;
          setDecisionBusy(false);
        }
      }
    }
    const [quoteBusy, setQuoteBusy] = (0, import_react6.useState)(false);
    async function submitQuote() {
      if (!booking2) return;
      const n = Math.round(Number(quoteRupees) * 100);
      if (!Number.isFinite(n) || n < 100) {
        setError("Enter the quote in rupees, at least 1.");
        return;
      }
      setQuoteBusy(true);
      try {
        await setBookingQuote(booking2.id, n);
        setError(null);
        window.location.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the quote.");
      } finally {
        setQuoteBusy(false);
      }
    }
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(BookingReference, { compact, title: compact ? "Original booking slot" : "Slot", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Date" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: formatDayLong(booking2.scheduledDate) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Time" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { children: [
            formatTime(booking2.scheduledAt),
            " to ",
            formatTime(booking2.estimatedEndAt)
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Length" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: formatDuration(booking2.durationMinutes) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Bay" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: bayName || "Assigned bay" })
        ] }),
        booking2.rescheduleCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Rescheduled" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { children: [
            booking2.rescheduleCount,
            " ",
            booking2.rescheduleCount === 1 ? "time" : "times"
          ] })
        ] })
      ] }),
      booking2.rescheduleRequest ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { className: "ax-panel", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "ax-label", children: "Reschedule request" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Requested" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { children: [
            formatDayLong(booking2.rescheduleRequest.requestedDate),
            " at ",
            booking2.rescheduleRequest.requestedTime
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Status" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { children: [
            booking2.rescheduleRequest.status === "pending" ? "Waiting for a decision" : booking2.rescheduleRequest.status,
            booking2.rescheduleRequest.decidedAt ? ` \xB7 ${formatDayLong(booking2.rescheduleRequest.decidedAt.slice(0, 10))}` : ""
          ] })
        ] }),
        booking2.rescheduleRequest.note ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Customer note" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: booking2.rescheduleRequest.note })
        ] }) : null,
        booking2.rescheduleRequest.status === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "ax-note", children: "Approving moves the booking to the requested time if a bay is free; the price and advance do not change. One request per booking." }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("input", { className: "ax-input", placeholder: "Note (optional)", value: decisionNote, onChange: (e) => setDecisionNote(e.target.value) }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", className: "ax-button ax-button--primary", disabled: decisionBusy, onClick: () => void decide(true), children: "Approve move" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", className: "ax-button", disabled: decisionBusy, onClick: () => void decide(false), children: "Decline" })
          ] })
        ] }) : null
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(CancelBookingPanel, { booking: booking2, job: job2, compact }),
      NO_SHOW_REVIEW_ENABLED && booking2.status === "CANCELLED" && booking2.missedAt ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(NoShowPanel, { booking: booking2, onError }) : null,
      booking2.priceOnRequest === true && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { className: "ax-panel", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "ax-label", children: "Quote" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { children: [
            service2?.brand ? `${service2.brand} \xB7 ` : "",
            service2?.name ?? "Product"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: booking2.quoteStatus === "approved" ? "Customer approved" : booking2.quoteStatus === "quoted" ? "Waiting for customer" : booking2.quoteStatus === "declined" ? "Customer declined" : "Needs a price" })
        ] }),
        booking2.quoteStatus !== "approved" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", gap: 8, marginTop: 12, alignItems: "center" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("input", { className: "ax-input", inputMode: "decimal", placeholder: "Price in rupees, before tax", value: quoteRupees, onChange: (e) => setQuoteRupees(e.target.value) }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", className: "ax-button ax-button--primary", disabled: quoteBusy, onClick: () => void submitQuote(), children: booking2.quoteStatus === "quoted" ? "Update quote" : "Send quote" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "ax-note", children: "Quotes are valid for 7 days. Work waits for customer approval. Changed scope or price needs fresh approval." }),
        booking2.quoteStatus === "quoted" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "ax-note", children: booking2.quoteExpiresAt ? `Valid until ${new Date(booking2.quoteExpiresAt).toLocaleString("en-IN")}` : "Reissue this quote to add its validity date." }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("a", { className: "ax-button", href: `https://app.autodeck.in/bookings/${encodeURIComponent(booking2.id)}`, target: "_blank", rel: "noopener noreferrer", children: "Open customer approval link" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "ax-note", children: "For the customer to open in their browser and sign in. No installation needed. This link does not approve or send anything." })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(BookingReference, { compact, title: compact ? "Original booking price" : "Price", children: [
        !pb2 ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Price breakdown" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "ax-data", children: "Not available" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Total" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "ax-data", children: typeof booking2.totalAmount === "number" && Number.isFinite(booking2.totalAmount) ? formatPaise(booking2.totalAmount) : "Not available" })
          ] })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: service2?.name ?? "Service" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "ax-data", children: formatPaise(pb2.basePrice) })
          ] }),
          pb2.scopeAdjustment !== 0 && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Size and scope" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "ax-data", children: formatPaise(pb2.scopeAdjustment) })
          ] }),
          typeof pb2.membershipDiscount === "number" && Number.isFinite(pb2.membershipDiscount) && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Membership" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "ax-data", style: { color: "var(--ad-premium)" }, children: [
              "-",
              formatPaise(pb2.membershipDiscount)
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Subtotal" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "ax-data", children: formatPaise(pb2.subtotal) })
          ] }),
          pb2.tax > 0 ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: pb2.taxDescription }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "ax-data", children: formatPaise(pb2.tax) })
          ] }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Total" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "ax-data", style: { color: "var(--ad-text-primary)" }, children: formatPaise(pb2.total) })
          ] })
        ] }),
        booking2.membershipDiscountApplied && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "ax-note", children: booking2.membershipWashUsed ? "Paid with a membership wash credit." : "Membership discount applied." })
      ] })
    ] });
  }
  function BookingReference({ compact, title, children }) {
    return compact ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("details", { className: "ax-panel ax-job-disclosure", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("summary", { children: title }),
      children
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { className: "ax-panel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "ax-label", children: title }),
      children
    ] });
  }

  // ../../../ad-admin-spacing26/apps/admin/src/components/JobControls.tsx
  var import_react8 = __toESM(require_react());
  init_firebase();

  // ../../../ad-admin-spacing26/apps/admin/src/components/DeliveryDeclaration.tsx
  var import_react7 = __toESM(require_react());
  init_firebase();
  var import_jsx_runtime12 = __toESM(require_jsx_runtime());
  var KIND_LABELS = { ppf: "PPF", ceramic: "Ceramic" };
  var SCOPE_LABELS = { full_body: "Full body", full_front: "Full front", high_impact: "High impact" };
  var recordLabel = (p2) => {
    const kind = p2.kind === "ceramic" ? "Ceramic" : p2.kind === "ppf" ? "PPF" : "Protection";
    const scope = p2.coverage ? SCOPE_LABELS[p2.coverage] ?? p2.coverage : "scope not on record";
    const date = (p2.startDate ?? p2.createdAt ?? "").slice(0, 10) || "date not on record";
    const source = p2.source === "customer" ? "customer entry" : "studio record";
    return `${kind} - ${scope}${p2.provider ? ` (${p2.provider})` : ""} - ${date} - ${source} - ref ${p2.id}`;
  };
  var sameAuth = (a, b) => a === b || a !== null && b !== null && a.uid === b.uid && a.role === b.role && a.tenantId === b.tenantId && a.studioId === b.studioId;
  var affirmable = (a, job2) => a !== null && (a.role === "studio" || a.role === "admin" || a.role === "superadmin") && (a.role === "superadmin" || a.tenantId !== null && a.tenantId === job2.tenantId) && (a.role !== "studio" || a.studioId !== null && a.studioId === job2.studioId);
  var contextSig = (job2, auth) => [
    job2.id,
    job2.vehicleId,
    job2.tenantId,
    job2.studioId,
    job2.status,
    auth ? `${auth.uid}:${auth.role ?? "-"}:${auth.tenantId ?? "-"}:${auth.studioId ?? "-"}` : "signed-out"
  ].join("|");
  function DeliveryDeclaration({ job: job2, onDelivered, onCancel }) {
    const { user, claims, loading: authLoading } = useAdminAuth();
    const liveAuth = authLoading ? void 0 : user && claims ? { uid: user.uid, role: claims.role ?? null, tenantId: claims.tenantId ?? null, studioId: claims.studioId ?? null } : null;
    const frozen = (0, import_react7.useRef)(null);
    const generation = (0, import_react7.useRef)(0);
    const inFlight = (0, import_react7.useRef)(false);
    const mounted = (0, import_react7.useRef)(true);
    const [protections, setProtections] = (0, import_react7.useState)([]);
    const [loading, setLoading] = (0, import_react7.useState)(true);
    const [loadError, setLoadError] = (0, import_react7.useState)(false);
    const [integrityError, setIntegrityError] = (0, import_react7.useState)(false);
    const [draft, setDraft] = (0, import_react7.useState)({ choice: null });
    const [pending, setPending] = (0, import_react7.useState)(false);
    const [submitError, setSubmitError] = (0, import_react7.useState)(null);
    const [reset, setReset] = (0, import_react7.useState)(0);
    const authReady = liveAuth !== void 0;
    const liveSig = authReady ? contextSig(job2, liveAuth) : null;
    const liveSigRef = (0, import_react7.useRef)(liveSig);
    liveSigRef.current = liveSig;
    const prevSigRef = (0, import_react7.useRef)(liveSig);
    const invalidGen = (0, import_react7.useRef)(0);
    if (prevSigRef.current !== liveSig) {
      prevSigRef.current = liveSig;
      invalidGen.current += 1;
    }
    if (frozen.current === null && authReady && affirmable(liveAuth, job2)) {
      frozen.current = { jobId: job2.id, vehicleId: job2.vehicleId, tenantId: job2.tenantId, studioId: job2.studioId, auth: liveAuth };
    }
    const f = frozen.current;
    const invalid = !authReady ? "verifying" : !affirmable(liveAuth, job2) ? "account" : !f ? null : job2.id !== f.jobId || job2.vehicleId !== f.vehicleId || job2.tenantId !== f.tenantId || job2.studioId !== f.studioId ? "job" : !sameAuth(liveAuth, f.auth) ? "account" : job2.status !== "READY_FOR_DELIVERY" ? "stage" : null;
    const contextValid = invalid === null;
    const payload = buildProtectionWork(draft, protections);
    const load = (0, import_react7.useCallback)(async (ctx) => {
      const gen = ++generation.current;
      const startSig = liveSigRef.current;
      setLoading(true);
      setLoadError(false);
      setIntegrityError(false);
      try {
        const snap = await getDocs(query(collection(db, SUBCOLLECTIONS.vehicleProtections(ctx.vehicleId)), where("tenantId", "==", ctx.tenantId)));
        if (gen !== generation.current || liveSigRef.current !== startSig) return;
        const records = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        if (records.some((r) => r.vehicleId !== ctx.vehicleId)) {
          setIntegrityError(true);
          setProtections([]);
          return;
        }
        setProtections(records);
      } catch {
        if (gen !== generation.current || liveSigRef.current !== startSig) return;
        setLoadError(true);
        setProtections([]);
      } finally {
        if (gen === generation.current && liveSigRef.current === startSig) setLoading(false);
      }
    }, []);
    (0, import_react7.useEffect)(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
        generation.current += 1;
      };
    }, []);
    (0, import_react7.useEffect)(() => {
      if (frozen.current && loading && protections.length === 0 && !loadError && !integrityError) void load(frozen.current);
    }, [authReady, load]);
    (0, import_react7.useEffect)(() => {
      if (invalid !== null && invalid !== "verifying") {
        generation.current += 1;
        setLoading(false);
        setLoadError(false);
        setIntegrityError(false);
        setProtections([]);
        setDraft({ choice: null });
        setPending(false);
        setSubmitError(null);
      }
    }, [invalid]);
    function reload() {
      if (inFlight.current || !authReady) return;
      if (!affirmable(liveAuth, job2)) return;
      frozen.current = { jobId: job2.id, vehicleId: job2.vehicleId, tenantId: job2.tenantId, studioId: job2.studioId, auth: liveAuth };
      setDraft({ choice: null });
      setSubmitError(null);
      setReset((k) => k + 1);
      void load(frozen.current);
    }
    async function confirm() {
      if (inFlight.current) return;
      if (!contextValid || loading || loadError || integrityError || payload === null) return;
      inFlight.current = true;
      setPending(true);
      setSubmitError(null);
      const ctx = f;
      const startSig = liveSigRef.current;
      const startGen = invalidGen.current;
      const frozenPayload = payload;
      const stillCurrent = () => mounted.current && liveSigRef.current === startSig && invalidGen.current === startGen;
      try {
        await httpsCallable(functions, "advanceJobStatus")({ jobId: ctx.jobId, protectionWork: frozenPayload });
        if (!stillCurrent()) {
          inFlight.current = false;
          return;
        }
        onDelivered();
      } catch (err) {
        if (!stillCurrent()) {
          inFlight.current = false;
          return;
        }
        setSubmitError(err instanceof Error ? err.message : "Could not mark delivered. Reload the declaration and try again.");
        inFlight.current = false;
        setPending(false);
      }
    }
    const targets = targetableRecords(protections);
    const setEvents = (events) => setDraft({ choice: "work", events });
    const updateEvent = (i, ev) => setDraft((d) => d.choice === "work" ? { choice: "work", events: d.events.map((e, j) => j === i ? ev : e) } : d);
    const dis = pending;
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "ax-delivery", style: { display: "grid", gap: 8, minWidth: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { children: "Mark delivered? This updates the studio, admin and customer tracker." }),
      invalid === "verifying" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { role: "status", children: "Verifying the signed-in account..." }) : invalid === "job" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { role: "alert", children: "This job changed since the declaration was opened. Reload the declaration for the job now on screen before delivering." }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { className: "ax-button", disabled: dis, onClick: reload, children: "Reload declaration" })
      ] }) : invalid === "account" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { role: "alert", children: "The signed-in account or its permissions changed since this declaration was opened - the earlier affirmation belongs to another operator context. Reload the declaration under the current account." }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { className: "ax-button", disabled: dis, onClick: reload, children: "Reload declaration" })
      ] }) : invalid === "stage" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { role: "alert", children: "This job is no longer awaiting delivery - it may already have been delivered. Go back and refresh the job." }) : loading ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { role: "status", children: "Loading the car's protection records..." }) : loadError ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { role: "alert", children: "Could not load the car's protection records. Reload and try again before delivering." }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { className: "ax-button", disabled: dis, onClick: reload, children: "Reload records" })
      ] }) : integrityError ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { role: "alert", children: "The car's protection records failed an integrity check (a record does not belong to this car). Go back and reopen the job before delivering." }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("fieldset", { disabled: dis, style: { display: "grid", gap: 8, border: "none", padding: 0, margin: 0, minWidth: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("legend", { className: "ax-label", children: "Protection work on this visit" }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { children: `Record exactly the protection work performed on this visit - this becomes the car's protection history. Choose "none" only if no protection work was done.` }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("label", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("input", { type: "radio", name: "decl-choice", checked: draft.choice === "none", onChange: () => setDraft({ choice: "none" }) }),
              " No protection work"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("label", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("input", { type: "radio", name: "decl-choice", checked: draft.choice === "work", onChange: () => setDraft({ choice: "work", events: [] }) }),
              " Record work"
            ] })
          ] }),
          draft.choice === "work" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { style: { display: "grid", gap: 12, minWidth: 0 }, children: [
            draft.events.map((ev, i) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { style: { display: "grid", gap: 4, border: "1px solid var(--ax-border, #444)", padding: 8, minWidth: 0 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { children: ev.action === "install" ? "New install" : ev.action === "replace" ? "Replace (like-for-like)" : "Remove" }),
              ev.action === "install" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("label", { children: [
                  "Type ",
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("select", { "aria-label": `Install ${i + 1} type`, value: ev.kind ?? "", onChange: (e) => updateEvent(i, { ...ev, kind: e.target.value || null }), children: [
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("option", { value: "", children: "Choose type" }),
                    Object.keys(KIND_LABELS).map((k) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("option", { value: k, children: KIND_LABELS[k] }, k))
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("label", { children: [
                  "Scope ",
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("select", { "aria-label": `Install ${i + 1} scope`, value: ev.coverage ?? "", onChange: (e) => updateEvent(i, { ...ev, coverage: e.target.value || null }), children: [
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("option", { value: "", children: "Choose scope" }),
                    Object.keys(SCOPE_LABELS).map((c) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("option", { value: c, children: SCOPE_LABELS[c] }, c))
                  ] })
                ] })
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
                targets.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("p", { role: "alert", children: [
                  "No current PPF/ceramic records on this car to ",
                  ev.action,
                  "."
                ] }) : null,
                /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("label", { style: { minWidth: 0 }, children: [
                  "Record ",
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("select", { style: { width: "100%", minWidth: 0, maxWidth: "100%" }, "aria-label": `${ev.action === "replace" ? "Replace" : "Remove"} target ${i + 1}`, value: ev.targetProtectionId ?? "", onChange: (e) => {
                    const t = targets.find((p2) => p2.id === e.target.value);
                    updateEvent(i, t ? selectTarget(ev, t) : { ...ev, targetProtectionId: null, expectedRevision: null });
                  }, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("option", { value: "", children: "Choose the record" }),
                    targets.map((p2) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("option", { value: p2.id, children: recordLabel(p2) }, p2.id))
                  ] })
                ] }),
                ev.action === "replace" && ev.targetProtectionId ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { children: "Same type and scope as the record above. Brand and warranty below are for the NEW work - leave blank if not known." }) : null
              ] }),
              ev.action !== "remove" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("label", { children: [
                  "Brand (optional) ",
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("input", { value: ev.brand, onChange: (e) => updateEvent(i, { ...ev, brand: e.target.value }) })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("label", { children: [
                  "Warranty years ",
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("input", { inputMode: "numeric", value: ev.warrantyYears, onChange: (e) => updateEvent(i, { ...ev, warrantyYears: e.target.value }) })
                ] })
              ] }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { className: "ax-button", onClick: () => setEvents(draft.choice === "work" ? draft.events.filter((_, j) => j !== i) : []), children: "Remove this entry" })
            ] }, i)),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", minWidth: 0 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { className: "ax-button", onClick: () => setEvents([...draft.events, newInstallDraft()]), children: "Add install" }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { className: "ax-button", onClick: () => setEvents([...draft.events, newReplaceDraft()]), children: "Add replace" }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { className: "ax-button", onClick: () => setEvents([...draft.events, newRemoveDraft()]), children: "Add removal" })
            ] }),
            payload === null ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { children: "Finish each entry to continue - every install needs a type and scope, every replace/removal needs a current record." }) : null
          ] }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { className: "ax-button", disabled: dis, onClick: reload, children: "Reload records" })
      ] }),
      submitError ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { role: "alert", children: submitError }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { className: "ax-button", disabled: dis || !contextValid || loading || loadError || integrityError || payload === null, onClick: () => void confirm(), children: "Confirm mark delivered" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { className: "ax-button", disabled: dis, onClick: onCancel, children: "Cancel" })
    ] }, reset);
  }

  // ../../../ad-admin-spacing26/apps/admin/src/components/JobControls.tsx
  var import_jsx_runtime13 = __toESM(require_jsx_runtime());
  var NEXT = { PENDING_VEHICLE: "Car arrived, start work", VEHICLE_RECEIVED: "Start work", IN_PROGRESS: "Done, ready for handover", QUALITY_CHECK: "Mark ready", READY_FOR_DELIVERY: "Mark delivered" };
  var label = (slot) => new Date(slot.startAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + " IST";
  function JobControls({ job: job2, routeId }) {
    const [bays, setBays] = (0, import_react8.useState)([]);
    const [operation, setOperation] = (0, import_react8.useState)(null);
    const [bay, setBay] = (0, import_react8.useState)("");
    const [busy, setBusy] = (0, import_react8.useState)(false);
    const [open, setOpen] = (0, import_react8.useState)(false);
    const [slots, setSlots] = (0, import_react8.useState)([]);
    const [pick, setPick] = (0, import_react8.useState)(null);
    const { user, claims, loading } = useAdminAuth();
    const [advanceConfirm, setAdvanceConfirm] = (0, import_react8.useState)(null);
    const advanceFpPrev = (0, import_react8.useRef)(void 0);
    const advanceEpoch = (0, import_react8.useRef)(0);
    const advanceFp = !loading && user && claims ? `${user.uid}|${claims.role}|${claims.tenantId}|${claims.studioId ?? ""}` : "none";
    if (advanceFpPrev.current !== advanceFp) {
      advanceFpPrev.current = advanceFp;
      advanceEpoch.current += 1;
    }
    if (advanceConfirm && (advanceConfirm.route !== routeId || advanceConfirm.epoch !== advanceEpoch.current || advanceConfirm.jobId !== job2.id || advanceConfirm.status !== job2.status)) {
      setAdvanceConfirm(null);
    }
    const [error, setError] = (0, import_react8.useState)(null);
    const [done, setDone] = (0, import_react8.useState)(null);
    async function prepareStandby() {
      if (busy) return;
      setOperation("admit");
      setBusy(true);
      setError(null);
      try {
        const [c, s] = await Promise.all([getDoc(doc(db, COLLECTIONS.studioConfig(), job2.studioId)), getDoc(doc(db, COLLECTIONS.services(), job2.serviceId))]);
        const config = c.data();
        setBays((config?.bays ?? []).filter((b) => b.active && b.bayType === s.data()?.requiredBayType));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load bays.");
      } finally {
        setBusy(false);
      }
    }
    async function perform() {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        if (operation === "rework") await httpsCallable(functions, "advanceJobStatus")({ jobId: job2.id, rework: true });
        else await httpsCallable(functions, "standbyBooking")({ jobId: job2.id, action: operation, ...operation === "admit" ? { bayId: bay } : {} });
        setOperation(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update job.");
      } finally {
        setBusy(false);
      }
    }
    async function loadSlots() {
      if (busy) return;
      setOpen(true);
      setBusy(true);
      setError(null);
      setPick(null);
      setDone(null);
      try {
        const startDate = (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        const result = await httpsCallable(functions, "getAvailability")({ serviceId: job2.serviceId, studioId: job2.studioId, startDate, lookAheadDays: 14 });
        setSlots(result.data.slots.filter((slot) => Date.parse(slot.startAt) > Date.now()));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load upcoming slots.");
      } finally {
        setBusy(false);
      }
    }
    async function advance() {
      if (busy) return;
      setBusy(true);
      setError(null);
      setDone(null);
      try {
        const steps = job2.status === "PENDING_VEHICLE" || job2.status === "IN_PROGRESS" ? 2 : 1;
        for (let i = 0; i < steps; i++) await httpsCallable(functions, "advanceJobStatus")({ jobId: job2.id });
        setAdvanceConfirm(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update the stage.");
      } finally {
        setBusy(false);
      }
    }
    async function move() {
      if (!pick || !job2.bookingId || busy) return;
      setBusy(true);
      setError(null);
      try {
        await httpsCallable(functions, "rescheduleBooking")({ bookingId: job2.bookingId, newDate: pick.date, newTime: pick.startTime, idempotencyKey: `admin-${job2.id}-${Date.now()}` });
        setOpen(false);
        setPick(null);
        setDone("Booking rescheduled. The booking and job now use the new slot.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not reschedule. Reload the available times.");
      } finally {
        setBusy(false);
      }
    }
    const next = NEXT[job2.status];
    if (!next && job2.status !== "STANDBY") return null;
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("section", { className: "ax-card", style: { display: "grid", gap: 12, padding: 20 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("h2", { className: "ax-label", children: "Job controls" }),
      error ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { role: "alert", children: error }) : null,
      done ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { role: "status", children: done }) : null,
      operation ? /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { style: { display: "grid", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { children: operation === "enqueue" ? "Mark arrived - standby? This releases the old bay reservation. No slot or service start is promised." : operation === "rework" ? "Send this car back to Work in progress so it can be redone?" : "Admit the next standby car at the actual time? The server checks queue order, bay occupancy and upcoming reservations." }),
        operation === "admit" ? /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("select", { "aria-label": "Standby bay", value: bay, onChange: (e) => setBay(e.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("option", { value: "", children: "Choose a compatible bay" }),
          bays.map((b) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("option", { value: b.id, children: b.name }, b.id))
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("button", { className: "ax-button ax-button--primary", disabled: busy || operation === "admit" && !bay, onClick: () => void perform(), children: [
          "Confirm ",
          operation === "enqueue" ? "standby arrival" : operation === "rework" ? "send back" : "admission"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: "ax-button", disabled: busy, onClick: () => setOperation(null), children: "Cancel" })
      ] }) : null,
      job2.status === "STANDBY" ? /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { children: [
          "Waiting since ",
          new Date(job2.standbyArrivedAt ?? job2.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          ". No bay or time reserved."
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: "ax-button ax-button--primary", disabled: busy, onClick: () => void prepareStandby(), children: "Admit from standby" })
      ] }) : null,
      job2.status === "PENDING_VEHICLE" && job2.bookingId ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: "ax-button", disabled: busy || Date.parse(job2.scheduledAt) > Date.now(), onClick: () => setOperation("enqueue"), children: "Arrived - standby" }) : null,
      job2.status === "QUALITY_CHECK" ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { type: "button", className: "ax-inline-add", style: { justifySelf: "start" }, disabled: busy, onClick: () => setOperation("rework"), children: "Not up to standard? Send back for rework" }) : null,
      job2.status === "READY_FOR_DELIVERY" && job2.paymentStatus !== "paid" ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { role: "status", children: job2.totalAmount === 0 ? "Settle the membership-covered visit before marking delivered." : "Collect and confirm full payment before marking delivered." }) : null,
      next ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_jsx_runtime13.Fragment, { children: advanceConfirm ? job2.status === "READY_FOR_DELIVERY" ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(DeliveryDeclaration, { job: job2, onDelivered: () => setAdvanceConfirm(null), onCancel: () => setAdvanceConfirm(null) }, `${job2.id}:${job2.vehicleId}`) : /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { style: { display: "grid", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { children: [
          next,
          "? This updates the studio, admin and customer tracker."
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("button", { className: "ax-button ax-button--primary", disabled: busy, onClick: () => void advance(), children: [
          "Confirm ",
          next.toLowerCase()
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: "ax-button", disabled: busy, onClick: () => setAdvanceConfirm(null), children: "Cancel" })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: job2.status === "READY_FOR_DELIVERY" ? "ax-button" : "ax-button ax-button--primary", disabled: busy || job2.status === "READY_FOR_DELIVERY" && job2.paymentStatus !== "paid", onClick: () => job2.status === "READY_FOR_DELIVERY" ? setAdvanceConfirm({ route: routeId, jobId: job2.id, status: job2.status, epoch: advanceEpoch.current }) : void advance(), children: next }) }) : null,
      job2.status === "PENDING_VEHICLE" && job2.bookingId ? /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { children: "Late arrival? Move this booking to an upcoming slot before check-in. Same booking and job kept." }),
        !open ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: "ax-button", disabled: busy, onClick: () => void loadSlots(), children: "Reschedule" }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
          busy ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { role: "status", children: "Loading or saving..." }) : null,
          !busy && !error && slots.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { children: "No upcoming slots in the next 14 days." }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { style: { display: "grid", gap: 8, maxHeight: 280, overflowY: "auto" }, children: slots.map((slot) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: pick?.startAt === slot.startAt ? "ax-button ax-button--primary" : "ax-button", "aria-pressed": pick?.startAt === slot.startAt, disabled: busy, onClick: () => setPick(slot), children: label(slot) }, slot.startAt)) }),
          pick ? /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("p", { children: [
              "Move this booking to ",
              label(pick),
              "? Bay capacity will be checked again before saving."
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: "ax-button ax-button--primary", disabled: busy, onClick: () => void move(), children: "Confirm reschedule" })
          ] }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: "ax-button", disabled: busy, onClick: () => void loadSlots(), children: "Reload available times" }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { className: "ax-button", disabled: busy, onClick: () => {
            setOpen(false);
            setPick(null);
          }, children: "Cancel" })
        ] })
      ] }) : null
    ] });
  }

  // ../../../ad-admin-spacing26/apps/admin/src/experience/StageTrack.tsx
  var import_jsx_runtime14 = __toESM(require_jsx_runtime());
  var JOB_STAGES = ["PENDING_VEHICLE", "VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY", "DELIVERED"];
  function StageTrack({ current, stages = JOB_STAGES, compact = false }) {
    const at = stages.indexOf(current);
    if (at < 0) {
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { className: "ax-track-off", children: statusLabel(current) });
    }
    if (compact) return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "ax-job-progress", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "ax-job-progress-label", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
          "Stage ",
          at + 1,
          " of ",
          stages.length
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: at < stages.length - 1 ? `Next: ${statusLabel(stages[at + 1])}` : "Delivered" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("ol", { className: "ax-track ax-track--compact", "aria-label": "Progress", children: stages.map((stage2, i) => /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("li", { title: statusLabel(stage2), className: i < at ? "is-done" : i === at ? "is-now" : "", "aria-current": i === at ? "step" : void 0, children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "ax-track-dot", "aria-hidden": "true" }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "ax-sr-only", children: statusLabel(stage2) })
      ] }, stage2)) })
    ] });
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("ol", { className: "ax-track", "aria-label": "Progress", children: stages.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("li", { className: i < at ? "is-done" : i === at ? "is-now" : "", "aria-current": i === at ? "step" : void 0, children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "ax-track-dot", "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "ax-track-label", children: statusLabel(s) })
    ] }, s)) });
  }

  // ../../../ad-admin-spacing26/apps/admin/src/app/(admin)/jobs/[id]/page.tsx
  var import_jsx_runtime15 = __toESM(require_jsx_runtime());
  function JobDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { claims, user } = useAdminAuth();
    const scopeGeneration = (0, import_react9.useRef)(0);
    const [resolvedId, setResolvedId] = (0, import_react9.useState)("");
    const [resolvedPrincipal, setResolvedPrincipal] = (0, import_react9.useState)("");
    const [paymentScope, setPaymentScope] = (0, import_react9.useState)("");
    const [attempt, setAttempt] = (0, import_react9.useState)(0);
    const [bayName, setBayName] = (0, import_react9.useState)("");
    const [booking2, setBooking] = (0, import_react9.useState)(null);
    const [job2, setJob] = (0, import_react9.useState)(void 0);
    const [approvals, setApprovals] = (0, import_react9.useState)([]);
    const [payment2, setPayment] = (0, import_react9.useState)(void 0);
    const [linking, setLinking] = (0, import_react9.useState)(false);
    const [invoice2, setInvoice] = (0, import_react9.useState)(null);
    const [warranty, setWarranty] = (0, import_react9.useState)(null);
    const [inspection, setInspection] = (0, import_react9.useState)(null);
    const [audit, setAudit] = (0, import_react9.useState)([]);
    const [customer2, setCustomer] = (0, import_react9.useState)(null);
    const [vehicle2, setVehicle] = (0, import_react9.useState)(null);
    const [service2, setService] = (0, import_react9.useState)(null);
    const [error, setError] = (0, import_react9.useState)(null);
    const [method, setMethod] = (0, import_react9.useState)("cash");
    const [reference, setReference] = (0, import_react9.useState)("");
    const [recording, setRecording] = (0, import_react9.useState)(false);
    const [status, setStatus] = (0, import_react9.useState)(null);
    const [confirming, setConfirming] = (0, import_react9.useState)(false);
    (0, import_react9.useEffect)(() => {
      const generation = ++scopeGeneration.current;
      setError(null);
      setPayment(void 0);
      setInvoice(null);
      setCustomer(null);
      setVehicle(null);
      setService(null);
      setStatus(null);
      setResolvedId("");
      setResolvedPrincipal("");
      setPaymentScope("");
      setLinking(false);
      setRecording(false);
      setConfirming(false);
      setBooking(null);
      if (!id) {
        setJob(null);
        return void 0;
      }
      setJob(void 0);
      const stop3 = listenToJob(id, (value) => {
        if (scopeGeneration.current !== generation) return;
        setResolvedId(id);
        setResolvedPrincipal(user?.uid ?? "");
        setJob(value);
        setError(null);
      }, (err) => {
        if (scopeGeneration.current === generation) setError(err.message);
      });
      return () => {
        scopeGeneration.current++;
        stop3();
      };
    }, [id, attempt, claims?.tenantId, user?.uid, claims?.role]);
    const bookingId = job2?.bookingId ?? null;
    (0, import_react9.useEffect)(() => {
      if (!bookingId) {
        setBooking(null);
        return void 0;
      }
      let alive = true;
      setBooking(null);
      const stop3 = listenToBooking(bookingId, (v) => {
        if (alive) setBooking(v);
      }, (err) => {
        if (alive) setError(err.message);
      });
      return () => {
        alive = false;
        stop3();
      };
    }, [bookingId, attempt]);
    (0, import_react9.useEffect)(() => {
      setPayment(void 0);
      setPaymentScope("");
      setInvoice(null);
      setApprovals([]);
      setInspection(null);
      setAudit([]);
      setWarranty(null);
      if (!job2 || !claims || !user || resolvedPrincipal !== user.uid || job2.id !== id || job2.tenantId !== claims.tenantId || resolvedId !== id) return;
      let alive = true;
      const scope = [id, claims.tenantId, user.uid].join("|");
      const safe = (set) => (v) => {
        if (alive) set(v);
      };
      const fail = (err) => {
        if (alive) {
          setPayment(void 0);
          setInvoice(null);
          setError(err.message);
        }
      };
      const unsubApprovals = listenToApprovalsForJob(job2.id, claims.tenantId, safe(setApprovals), fail);
      const unsubPayment = listenToPaymentForJob(job2.id, claims.tenantId, (p2) => {
        if (!alive) return;
        if (p2 && (p2.jobId !== id || p2.tenantId !== claims.tenantId)) {
          fail(Error("Payment record does not match this job."));
          return;
        }
        setPayment(p2);
        setPaymentScope(scope);
      }, fail);
      const unsubInvoice = listenToInvoiceForJob(job2.id, claims.tenantId, (v) => {
        if (!alive) return;
        if (v && (v.jobId !== id || v.tenantId !== claims.tenantId)) {
          fail(Error("Invoice does not match this job."));
          return;
        }
        setInvoice(v);
      }, fail);
      const unsubAudit = listenToAuditForEntity(claims.tenantId, "ServiceJob", job2.id, safe(setAudit), fail);
      const unsubInspection = listenToInspectionForJob(job2.id, safe(setInspection), () => {
      });
      void getWarrantyForJob(job2.id).then(safe(setWarranty)).catch(() => {
        if (alive) setWarranty(null);
      });
      void getCustomer(job2.customerId).then(safe(setCustomer)).catch(() => {
        if (alive) setCustomer(null);
      });
      void getVehicle(job2.vehicleId).then(safe(setVehicle)).catch(() => {
        if (alive) setVehicle(null);
      });
      void getService(job2.serviceId).then(safe(setService)).catch(() => {
        if (alive) setService(null);
      });
      return () => {
        alive = false;
        unsubApprovals();
        unsubPayment();
        unsubInvoice();
        unsubAudit();
        unsubInspection();
      };
    }, [job2?.id, job2?.customerId, job2?.vehicleId, job2?.serviceId, claims?.tenantId, attempt, resolvedId, id, user?.uid, resolvedPrincipal]);
    const currentScope = !!claims && !!user && resolvedPrincipal === user.uid && resolvedId === id && job2?.id === id && job2?.tenantId === claims.tenantId;
    const currentPayment = currentScope && paymentScope === [id, claims?.tenantId, user?.uid].join("|") ? payment2 : void 0;
    async function handleRecordPayment() {
      if (!job2 || !currentScope || currentPayment === void 0) return;
      const generation = scopeGeneration.current;
      setStatus(null);
      setRecording(true);
      try {
        const fn = httpsCallable(
          functions,
          "recordManualPayment"
        );
        await fn(reference ? { jobId: job2.id, method, manualReference: reference } : { jobId: job2.id, method });
        if (scopeGeneration.current === generation) setStatus("Payment recorded and invoice issued.");
        if (scopeGeneration.current === generation) setReference("");
      } catch (err) {
        if (scopeGeneration.current === generation) setStatus(err instanceof Error ? err.message : "Failed to record payment.");
      } finally {
        if (scopeGeneration.current === generation) setRecording(false);
      }
    }
    async function handleCreateLink() {
      if (!job2 || !currentScope || currentPayment === void 0) return;
      const generation = scopeGeneration.current;
      setStatus(null);
      setLinking(true);
      try {
        const fn = httpsCallable(functions, "initiatePayment");
        const res = await fn({ jobId: job2.id, method: "razorpay_payment_link" });
        if (scopeGeneration.current === generation) setStatus(res.data.paymentUrl ? "Payment link ready. Copy it or send it on WhatsApp." : "A payment is already in progress for this job.");
      } catch (err) {
        if (scopeGeneration.current === generation) setStatus(err instanceof Error ? err.message : "Could not create the payment link.");
      } finally {
        if (scopeGeneration.current === generation) setLinking(false);
      }
    }
    async function handleConfirmCashPayment() {
      if (!currentPayment || !currentScope) return;
      const generation = scopeGeneration.current;
      setStatus(null);
      setConfirming(true);
      try {
        const fn = httpsCallable(functions, "confirmManualPayment");
        await fn({ paymentId: currentPayment.id });
        if (scopeGeneration.current === generation) setStatus("Payment confirmed and invoice issued.");
      } catch (err) {
        if (scopeGeneration.current === generation) setStatus(err instanceof Error ? err.message : "Failed to confirm payment.");
      } finally {
        if (scopeGeneration.current === generation) setConfirming(false);
      }
    }
    (0, import_react9.useEffect)(() => {
      if (!job2) return;
      let alive = true;
      setBayName("");
      void getStudioConfig(job2.studioId).then((c) => {
        if (alive) setBayName(c?.bays.find((b) => b.id === job2.bayId)?.name ?? "");
      }).catch(() => {
        if (alive) setBayName("");
      });
      return () => {
        alive = false;
      };
    }, [job2?.studioId, job2?.bayId, attempt]);
    if (error) return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "ax-panel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "ax-status-msg ax-status-msg--warn", role: "alert", children: error }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { className: "ax-button", onClick: () => setAttempt((n) => n + 1), children: "Retry" })
    ] });
    if (!currentScope && job2 !== null || job2 === void 0) return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "ax-label", role: "status", children: "Loading\u2026" });
    if (job2 === null) {
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "ax-empty", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "ax-title", children: "Job not found" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { children: "It may have been removed, or the link is wrong." })
      ] });
    }
    const plate = vehicle2?.registrationNumber ?? "Vehicle";
    const car = vehicle2 ? `${vehicle2.make} ${vehicle2.model}` : "";
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "ax-page ax-job-page", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { type: "button", className: "ax-back", onClick: () => goBackOrTo(router, "/jobs"), children: "\u2039 Back" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("header", { className: "ax-hero ax-job-hero", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("p", { className: "ax-label", children: [
            job2.isWalkIn ? "Walk-in job" : "Booked job",
            " \xB7 ",
            service2?.name ?? "Service"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("h1", { children: plate }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "ax-hero-sub", children: [car, customer2?.name].filter(Boolean).join(" \xB7 ") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "ax-hero-side ax-job-summary", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "ax-label", children: "Job stage" }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(StatusBadge, { label: job2.status }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "ax-label", children: "Job total" }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "ax-hero-total", children: formatPaise(job2.totalAmount) }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "ax-label", children: "Payment" }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(StatusBadge, { label: membershipCoveredLabel(job2) ?? (payment2?.invoiceReviewNeeded ? "Received - needs review" : payment2?.status === "completed" && job2.paymentStatus !== "paid" || job2.paymentStatus === "paid" && payment2?.status !== "completed" ? "Payment records syncing" : job2.paymentStatus) }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("details", { className: "ax-job-price-details", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("summary", { children: "Price breakdown" }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Service" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: typeof job2.priceBreakdown?.total === "number" ? formatPaise(job2.priceBreakdown.total) : "Not available" })
            ] }),
            job2.additionalWorkDelta !== 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Extra work" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: formatPaise(job2.additionalWorkDelta) })
            ] }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "ax-note", children: "Original booking prices and payment receipts are listed separately below." })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(StageTrack, { current: job2.status, compact: true }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(JobControls, { job: job2, routeId: id }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MembershipSettlement, { job: job2, booking: booking2 ?? null }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "ax-detail", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "ax-detail-main", children: [
          booking2 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BookingPanels, { compact: true, booking: booking2, job: job2, service: service2, bayName, onError: setError }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("details", { className: "ax-panel ax-job-disclosure", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("summary", { children: [
              "Stage history (",
              job2.statusHistory.length,
              ")"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("ol", { className: "ax-timeline", children: [...job2.statusHistory].reverse().map((h, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("li", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "ax-timeline-dot", "aria-hidden": "true" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { children: [
                statusLabel(h.status),
                h.notes && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "ax-timeline-note", children: h.notes })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "ax-timeline-meta", children: formatDateTime(h.changedAt) })
            ] }, i)) })
          ] }),
          inspection && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("section", { className: "ax-panel", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "ax-label", children: [
              "Inspection \xB7 ",
              inspection.status === "finalized" ? "Finalized" : "In progress"
            ] }),
            inspection.finalizedAt && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("p", { className: "ax-note", style: { marginTop: 0 }, children: [
              "Finalized ",
              formatDateTime(inspection.finalizedAt)
            ] }),
            ["exterior", "glass", "interior", "service_specific"].map((area) => {
              const items = inspection.checklist.filter((i) => i.area === area && i.rating);
              if (items.length === 0) return null;
              return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: { marginTop: 12 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "ax-label", style: { margin: "0 0 4px" }, children: area.replace("_", " ") }),
                items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: item.label }),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { children: [
                    statusLabel(item.rating ?? ""),
                    item.notes ? ` \xB7 ${item.notes}` : ""
                  ] })
                ] }, item.key))
              ] }, area);
            }),
            inspection.overallNotes && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { style: { marginTop: 12, marginBottom: 0 }, children: inspection.overallNotes })
          ] }),
          approvals.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("section", { className: "ax-panel", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "ax-label", children: "Extra work approvals" }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("table", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("tr", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: "Work" }),
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: "Status" }),
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { style: { textAlign: "right" }, children: "Price" }),
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: "Asked" })
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("tbody", { children: approvals.map((a) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("tr", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: a.serviceName }),
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(StatusBadge, { label: a.status }) }),
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { className: "ax-data", style: { textAlign: "right" }, children: formatPaise(a.priceImpact) }),
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: formatDateTime(a.createdAt) })
              ] }, a.id)) })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("details", { className: "ax-panel ax-job-disclosure", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("summary", { children: [
              "Job activity (",
              audit.length,
              ")"
            ] }),
            audit.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "ax-note", style: { marginTop: 0 }, children: "No recorded changes yet." }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("ol", { className: "ax-timeline", children: audit.map((a) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("li", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "ax-timeline-dot", style: { background: "var(--ad-inactive)" }, "aria-hidden": "true" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { children: [
                jobActivityLabel(a.action),
                /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "ax-timeline-note", children: [
                  "by ",
                  statusLabel(a.performedByRole)
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "ax-timeline-meta", children: formatDateTime(a.createdAt) })
            ] }, a.id)) })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("aside", { className: "ax-detail-side", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("details", { className: "ax-panel ax-job-disclosure", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("summary", { children: "Car and owner" }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Customer" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: customer2?.name ?? "-" })
            ] }),
            customer2?.phone && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Phone" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("a", { href: `tel:${customer2.phone}`, children: customer2.phone }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Vehicle" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: car || "-" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Plate" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "ax-data", children: vehicle2?.registrationNumber ?? "-" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "ax-panel-actions", children: customer2?.id && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { type: "button", className: "ax-button", onClick: () => router.push(`/customers/${customer2.id}`), children: "Open customer" }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("details", { className: "ax-panel ax-job-disclosure", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("summary", { children: "Bay and timing" }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Bay" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: job2.status === "STANDBY" ? "No bay reserved" : bayName || "Assigned bay" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Starts" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: job2.status === "STANDBY" ? "Waiting - no slot reserved" : formatDateTime(job2.scheduledAt) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Est. finish" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: formatDateTime(job2.estimatedEndAt) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Work time" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: job2.estimatedDurationMinutes < 24 * 60 ? `About ${formatDuration(job2.estimatedDurationMinutes)}` : `About ${Math.round(job2.estimatedDurationMinutes / 60)} hrs` })
            ] }),
            job2.scheduledDate !== job2.estimatedEndDate && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("p", { className: "ax-note", children: [
              "Multi-day job. The bay is held ",
              formatDate(job2.scheduledDate),
              " to ",
              formatDate(job2.estimatedEndDate),
              "."
            ] }),
            job2.sealedAt && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Sealed" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: formatDateTime(job2.sealedAt) })
            ] })
          ] }),
          OFFLINE_RECEIPT_REGISTER_ENABLED && currentScope && currentPayment !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(OfflineReceiptPanel, { jobId: job2.id }, [job2.id, user?.uid, claims?.tenantId].join("|")) : null,
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            JobPaymentPanel,
            {
              compact: true,
              onRefreshPayment: () => {
                setPayment(void 0);
                setStatus("Refreshing AutoDeck payment record. This does not charge or record money.");
                setAttempt((n) => n + 1);
              },
              job: job2,
              booking: booking2,
              payment: currentPayment,
              invoice: invoice2,
              customer: customer2,
              status,
              setStatus,
              method,
              setMethod,
              reference,
              setReference,
              linking,
              recording,
              confirming,
              onCreateLink: () => void handleCreateLink(),
              onRecordPayment: () => void handleRecordPayment(),
              onConfirmCashPayment: () => void handleConfirmCashPayment(),
              onOpenInvoice: (invoiceId) => router.push(`/invoices/${invoiceId}`)
            }
          ),
          warranty && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("section", { className: "ax-panel", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "ax-label", children: "Protection" }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: warranty.warrantyLabel }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: warranty.endDate ? `Until ${formatDate(warranty.endDate)}` : "No fixed term" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Sealed" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: formatDateTime(warranty.sealedAt) })
            ] }),
            warranty.revokedAt && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Revoked" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: warranty.revokedReason })
            ] })
          ] })
        ] })
      ] })
    ] });
  }

  // pixel-job27/entry.tsx
  var import_jsx_runtime16 = __toESM(require_jsx_runtime());
  document.documentElement.dataset.theme = new URLSearchParams(location.search).get("theme") === "night" ? "night" : "light";
  (0, import_client.createRoot)(document.getElementById("root")).render(/* @__PURE__ */ (0, import_jsx_runtime16.jsx)(StaffShell, { pathname: "/jobs/SAMPLE-JOB", office: role === "admin", role, who: "Sample staff", home: "/dashboard", onSignOut: () => {
  }, children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(JobDetailPage, {}) }));
})();
/*! Bundled license information:

scheduler/cjs/scheduler.production.js:
  (**
   * @license React
   * scheduler.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react.production.js:
  (**
   * @license React
   * react.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-dom/cjs/react-dom.production.js:
  (**
   * @license React
   * react-dom.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-dom/cjs/react-dom-client.production.js:
  (**
   * @license React
   * react-dom-client.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react-jsx-runtime.production.js:
  (**
   * @license React
   * react-jsx-runtime.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
