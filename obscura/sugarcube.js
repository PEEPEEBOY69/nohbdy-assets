
	/*! SugarCube JS */
	if(document.documentElement.getAttribute("data-init")==="loading"){window.TWINE1=false;
window.DEBUG=false;
(function (window, document, jQuery, undefined) {
"use strict";

/***********************************************************************************************************************

	lib/alert.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

/*
	TODO: This regular expression should be elsewhere.

	Error prologs by engine/browser: (ca. 2018)
		Chrome, Opera, & Vivaldi → `Uncaught \w*Error: …`
		Edge & IE                → `…`
		Firefox                  → `Error: …`
		Opera (Presto)           → `Uncaught exception: \w*(?:Error|Exception): …`
		Safari (ca. v5.1)        → `\w*(?:Error|_ERR): …`
*/
var errorPrologRegExp = /^(?:(?:uncaught\s+(?:exception:\s+)?)?\w*(?:error|exception|_err):\s+)+/i; // eslint-disable-line no-unused-vars, no-var

var Alert = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
		Error Functions.
	*******************************************************************************************************************/
	function mesg(where, error, isFatal, isUncaught) {
		let mesg = 'Error';
		let nice = `A${isFatal ? ' fatal' : 'n'} error has occurred.`;

		if (isFatal) {
			nice += ' Aborting.';
		}
		else {
			nice += ' You may be able to continue, but some parts may not work properly.';
		}

		const isObject = error !== null && typeof error === 'object';
		const isExLike = isObject && 'message' in error;
		const what     = (
			isExLike ? String(error.message).replace(errorPrologRegExp, '') : String(error)
		).trim() || 'unknown error';

		if (where != null) { // lazy equality for null
			mesg += ` [${where}]`;
		}

		mesg += `: ${what}.`;

		if (isObject && 'stack' in error) {
			mesg += `\n\nStack Trace:\n${error.stack}`;
		}

		if (mesg) {
			nice += `\n\n${mesg}`;
		}

		// Log a plain message.
		if (!isUncaught) {
			console[isFatal ? 'error' : 'warn'](mesg);
		}

		// Pop up a nice message.
		window.alert(nice); // eslint-disable-line no-alert
	}

	function alertError(where, error) {
		mesg(where, error);
	}

	function alertFatal(where, error) {
		mesg(where, error, true);
	}


	/*******************************************************************************************************************
		Error Event.
	*******************************************************************************************************************/
	/*
		Set up a global error handler for uncaught exceptions.
	*/
	(origOnError => {
		window.onerror = function (what, source, lineNum, colNum, error) {
			// console.error(what, source, lineNum, colNum, error);

			// Uncaught exceptions during play may be recoverable/ignorable.
			if (document.readyState === 'complete') {
				mesg(null, error != null ? error : what, false, true); // lazy equality for null
			}

			// Uncaught exceptions during startup should be fatal.
			else {
				mesg(null, error != null ? error : what, true, true); // lazy equality for null
				window.onerror = origOnError;

				if (typeof window.onerror === 'function') {
					window.onerror.apply(this, arguments);
				}
			}
		};
	})(window.onerror);


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		error : { value : alertError },
		fatal : { value : alertFatal }
	}));
})();

/***********************************************************************************************************************

	lib/patterns.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/*
	TODO: Move all markup patterns into here.
*/

/* eslint-disable max-len */
var Patterns = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
		Patterns.
	*******************************************************************************************************************/
	/*
		Whitespace patterns.

		Space class (equivalent to `\s`):
			[\u0020\f\n\r\t\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]
		Space class, sans line terminators:
			[\u0020\f\t\v\u00a0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]
		Line Terminator class:
			[\n\r\u2028\u2029]
	*/
	const space = (() => {
		/*
			Some browsers still supported by SugarCube have faulty space classes (`\s`).
			We check for that lossage here and, if necessary, build our own class from
			the component pieces.
		*/
		const wsMap = new Map([
			['\u0020', '\\u0020'],
			['\f', '\\f'],
			['\n', '\\n'],
			['\r', '\\r'],
			['\t', '\\t'],
			['\v', '\\v'],
			['\u00a0', '\\u00a0'],
			['\u1680', '\\u1680'],
			['\u180e', '\\u180e'],
			['\u2000', '\\u2000'],
			['\u2001', '\\u2001'],
			['\u2002', '\\u2002'],
			['\u2003', '\\u2003'],
			['\u2004', '\\u2004'],
			['\u2005', '\\u2005'],
			['\u2006', '\\u2006'],
			['\u2007', '\\u2007'],
			['\u2008', '\\u2008'],
			['\u2009', '\\u2009'],
			['\u200a', '\\u200a'],
			['\u2028', '\\u2028'],
			['\u2029', '\\u2029'],
			['\u202f', '\\u202f'],
			['\u205f', '\\u205f'],
			['\u3000', '\\u3000'],
			['\ufeff', '\\ufeff']
		]);
		const wsRe = /^\s$/;
		let missing = '';

		wsMap.forEach((pat, char) => {
			if (!wsRe.test(char)) {
				missing += pat;
			}
		});

		return missing ? `[\\s${missing}]` : '\\s';
	})();
	const spaceNoTerminator = '[\\u0020\\f\\t\\v\\u00a0\\u1680\\u180e\\u2000-\\u200a\\u202f\\u205f\\u3000\\ufeff]';
	const lineTerminator    = '[\\n\\r\\u2028\\u2029]';
	const notSpace          = space === '\\s' ? '\\S' : space.replace(/^\[/, '[^');

	/*
		Character patterns.
	*/
	const anyChar = `(?:.|${lineTerminator})`;

	/*
		Letter patterns.

		FIXME:
			1. The existing set, which is a TiddlyWiki holdover, should probably
			   encompass a significantly greater range of BMP code points.
			2. Should we include the surrogate pair code units (\uD800-\uDBFF &
			   \uDC00-\uDFFF) to handle non-BMP code points?  Further, should we
			   simply be checking for the code units themselves or checking for
			   properly mated pairs?
	*/
	const anyLetter       = '[0-9A-Z_a-z\\-\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u00ff\\u0150\\u0170\\u0151\\u0171]';
	const anyLetterStrict = anyLetter.replace('\\-', ''); // anyLetter sans hyphen

	/*
		Identifier patterns.

		NOTE: Since JavaScript's RegExp syntax does not support Unicode character
		classes, the correct regular expression to match a valid identifier name,
		within the scope of our needs, would be on the order of approximately 5–6
		or 11–16 KiB, depending on how the pattern was built.  That being the case,
		for the moment we restrict valid TwineScript identifiers to US-ASCII.

		FIXME: Fix this to, at least, approximate the correct range.
	*/
	const identifierFirstChar = '[$A-Z_a-z]';
	const identifierNextChar  = '[$0-9A-Z_a-z]';
	const identifier          = `${identifierFirstChar}${identifierNextChar}*`;

	// Variable patterns.
	const variableSigil = '[$_]';
	const variable      = variableSigil + identifier;

	// Macro name pattern.
	const macroName = '[A-Za-z][\\w-]*|[=-]';

	// Template name pattern.
	const templateName = '[A-Za-z][\\w-]*';

	// HTML tag name pattern.
	const htmlTagName = (() => {
		/*
			Element Name:
				[A-Za-z] [0-9A-Za-z]*

			Custom Element Name:
				[a-z] (CENChar)* '-' (CENChar)*
			CENChar:
				"-" | "." | [0-9] | "_" | [a-z] | #xB7 | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x203F-#x2040] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
		*/
		const cENChar = '(?:[\\x2D.0-9A-Z_a-z\\xB7\\xC0-\\xD6\\xD8-\\xF6\\xF8-\\u037D\\u037F-\\u1FFF\\u200C\\u200D\\u203F\\u2040\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD]|[\\uD800-\\uDB7F][\\uDC00-\\uDFFF])';

		return `[A-Za-z](?:${cENChar}*-${cENChar}*|[0-9A-Za-z]*)`;
	})();

	// CSS ID or class sigil pattern.
	const cssIdOrClassSigil = '[#.]';

	// CSS image transclusion template pattern.
	//
	// NOTE: The alignment syntax isn't supported, but removing it might break uses
	// of the template in the wild, so we leave it alone for now.
	const cssImage = '\\[[<>]?[Ii][Mm][Gg]\\[(?:\\s|\\S)*?\\]\\]+';

	// Inline CSS pattern.
	const inlineCss = (() => {
		/* legacy */
		const twStyle   = `(${anyLetter}+)\\(([^\\)\\|\\n]+)\\):`;
		/* /legacy */
		const cssStyle  = `${spaceNoTerminator}*(${anyLetter}+)${spaceNoTerminator}*:([^;\\|\\n]+);`;
		const idOrClass = `${spaceNoTerminator}*((?:${cssIdOrClassSigil}${anyLetter}+${spaceNoTerminator}*)+);`;

		// [1,2] = style(value):
		// [3,4] = style:value;
		// [5]   = #id.className;
		return `${twStyle}|${cssStyle}|${idOrClass}`;
	})();

	// URL pattern.
	const url = '(?:file|https?|mailto|ftp|javascript|irc|news|data):[^\\s\'"]+';


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze({
		space,
		spaceNoTerminator,
		lineTerminator,
		notSpace,
		anyChar,
		anyLetter,
		anyLetterStrict,
		identifierFirstChar,
		identifierNextChar,
		identifier,
		variableSigil,
		variable,
		macroName,
		templateName,
		htmlTagName,
		cssIdOrClassSigil,
		cssImage,
		inlineCss,
		url
	});
})();
/* eslint-enable max-len */

/***********************************************************************************************************************

	lib/extensions.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Patterns */

/*
	JavaScript Polyfills.

	NOTE: The ES5 and ES6 polyfills come from the vendored `es5-shim.js` and `es6-shim.js` libraries.
*/
(() => {
	'use strict';

	/*******************************************************************************************************************
		Utility Functions.
	*******************************************************************************************************************/
	/*
		Trims whitespace from either the start or end of the given string.
	*/
	const _trimString = (() => {
		// Whitespace regular expressions.
		const startWSRe = new RegExp(`^${Patterns.space}${Patterns.space}*`);
		const endWSRe   = new RegExp(`${Patterns.space}${Patterns.space}*$`);

		function trimString(str, where) {
			const val = String(str);

			if (!val) {
				return val;
			}

			switch (where) {
			case 'start':
				return startWSRe.test(val) ? val.replace(startWSRe, '') : val;

			case 'end':
				return endWSRe.test(val) ? val.replace(endWSRe, '') : val;

			default:
				throw new Error(`_trimString called with incorrect where parameter value: "${where}"`);
			}
		}

		return trimString;
	})();

	/*
		Generates a pad string based upon the given string and length.
	*/
	function _createPadString(length, padding) {
		const targetLength = Number.parseInt(length, 10) || 0;

		if (targetLength < 1) {
			return '';
		}

		let padString = typeof padding === 'undefined' ? '' : String(padding);

		if (padString === '') {
			padString = ' ';
		}

		while (padString.length < targetLength) {
			const curPadLength    = padString.length;
			const remainingLength = targetLength - curPadLength;

			padString += curPadLength > remainingLength
				? padString.slice(0, remainingLength)
				: padString;
		}

		if (padString.length > targetLength) {
			padString = padString.slice(0, targetLength);
		}

		return padString;
	}


	/*******************************************************************************************************************
		Polyfills.
	*******************************************************************************************************************/
	/*
		[ES2019] Returns a new array consisting of the source array with all sub-array elements
		concatenated into it recursively up to the given depth.
	*/
	if (!Array.prototype.flat) {
		Object.defineProperty(Array.prototype, 'flat', {
			configurable : true,
			writable     : true,
			value        : (() => {
				function flat(/* depth */) {
					if (this == null) { // lazy equality for null
						throw new TypeError('Array.prototype.flat called on null or undefined');
					}

					const depth = arguments.length === 0 ? 1 : Number(arguments[0]) || 0;

					if (depth < 1) {
						return Array.prototype.slice.call(this);
					}

					return Array.prototype.reduce.call(
						this,
						(acc, cur) => {
							if (cur instanceof Array) {
								// acc.push.apply(acc, flat.call(cur, depth - 1));
								acc.push(...flat.call(cur, depth - 1));
							}
							else {
								acc.push(cur);
							}

							return acc;
						},
						[]
					);
				}

				return flat;
			})()
		});
	}

	/*
		[ES2019] Returns a new array consisting of the result of calling the given mapping function
		on every element in the source array and then concatenating all sub-array elements into it
		recursively up to a depth of `1`.  Identical to calling `<Array>.map(fn).flat()`.
	*/
	if (!Array.prototype.flatMap) {
		Object.defineProperty(Array.prototype, 'flatMap', {
			configurable : true,
			writable     : true,

			value(/* callback [, thisArg] */) {
				if (this == null) { // lazy equality for null
					throw new TypeError('Array.prototype.flatMap called on null or undefined');
				}

				return Array.prototype.map.apply(this, arguments).flat();
			}
		});
	}

	/*
		[ES2016] Returns whether the given element was found within the array.
	*/
	if (!Array.prototype.includes) {
		Object.defineProperty(Array.prototype, 'includes', {
			configurable : true,
			writable     : true,

			value(/* needle [, fromIndex] */) {
				if (this == null) { // lazy equality for null
					throw new TypeError('Array.prototype.includes called on null or undefined');
				}

				if (arguments.length === 0) {
					return false;
				}

				const length = this.length >>> 0;

				if (length === 0) {
					return false;
				}

				const needle = arguments[0];
				let i = Number(arguments[1]) || 0;

				if (i < 0) {
					i = Math.max(0, length + i);
				}

				for (/* empty */; i < length; ++i) {
					const value = this[i];

					if (value === needle || value !== value && needle !== needle) {
						return true;
					}
				}

				return false;
			}
		});
	}

	/*
		[ES2017] Returns a new array consisting of the given object's own enumerable property/value
		pairs as `[key, value]` arrays.
	*/
	if (!Object.entries) {
		Object.defineProperty(Object, 'entries', {
			configurable : true,
			writable     : true,

			value(obj) {
				if (typeof obj !== 'object' || obj === null) {
					throw new TypeError('Object.entries object parameter must be an object');
				}

				return Object.keys(obj).map(key => [key, obj[key]]);
			}
		});
	}

	/*
		[ES2019] Returns a new generic object consisting of the given list's key/value pairs.
	*/
	if (!Object.fromEntries) {
		Object.defineProperty(Object, 'fromEntries', {
			configurable : true,
			writable     : true,

			value(iter) {
				return Array.from(iter).reduce(
					(acc, pair) => {
						if (Object(pair) !== pair) {
							throw new TypeError('Object.fromEntries iterable parameter must yield objects');
						}

						if (pair[0] in acc) {
							Object.defineProperty(acc, pair[0], {
								configurable : true,
								enumerable   : true,
								writable     : true,
								value        : pair[1]
							});
						}
						else {
							acc[pair[0]] = pair[1]; // eslint-disable-line no-param-reassign
						}

						return acc;
					},
					{}
				);
			}
		});
	}

	/*
		[ES2017] Returns all own property descriptors of the given object.
	*/
	if (!Object.getOwnPropertyDescriptors) {
		Object.defineProperty(Object, 'getOwnPropertyDescriptors', {
			configurable : true,
			writable     : true,

			value(obj) {
				if (obj == null) { // lazy equality for null
					throw new TypeError('Object.getOwnPropertyDescriptors object parameter is null or undefined');
				}

				const O = Object(obj);

				return Reflect.ownKeys(O).reduce(
					(acc, key) => {
						const desc = Object.getOwnPropertyDescriptor(O, key);

						if (typeof desc !== 'undefined') {
							if (key in acc) {
								Object.defineProperty(acc, key, {
									configurable : true,
									enumerable   : true,
									writable     : true,
									value        : desc
								});
							}
							else {
								acc[key] = desc; // eslint-disable-line no-param-reassign
							}
						}

						return acc;
					},
					{}
				);
			}
		});
	}

	/*
		[ES2017] Returns a new array consisting of the given object's own enumerable property values.
	*/
	if (!Object.values) {
		Object.defineProperty(Object, 'values', {
			configurable : true,
			writable     : true,

			value(obj) {
				if (typeof obj !== 'object' || obj === null) {
					throw new TypeError('Object.values object parameter must be an object');
				}

				return Object.keys(obj).map(key => obj[key]);
			}
		});
	}

	/*
		[ES2017] Returns a string based on concatenating the given padding, repeated as necessary,
		to the start of the string so that the given length is reached.

		NOTE: This pads based upon Unicode code units, rather than code points.
	*/
	if (!String.prototype.padStart) {
		Object.defineProperty(String.prototype, 'padStart', {
			configurable : true,
			writable     : true,

			value(length, padding) {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.padStart called on null or undefined');
				}

				const baseString   = String(this);
				const baseLength   = baseString.length;
				const targetLength = Number.parseInt(length, 10);

				if (targetLength <= baseLength) {
					return baseString;
				}

				return _createPadString(targetLength - baseLength, padding) + baseString;
			}
		});
	}

	/*
		[ES2017] Returns a string based on concatenating the given padding, repeated as necessary,
		to the end of the string so that the given length is reached.

		NOTE: This pads based upon Unicode code units, rather than code points.
	*/
	if (!String.prototype.padEnd) {
		Object.defineProperty(String.prototype, 'padEnd', {
			configurable : true,
			writable     : true,

			value(length, padding) {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.padEnd called on null or undefined');
				}

				const baseString   = String(this);
				const baseLength   = baseString.length;
				const targetLength = Number.parseInt(length, 10);

				if (targetLength <= baseLength) {
					return baseString;
				}

				return baseString + _createPadString(targetLength - baseLength, padding);
			}
		});
	}

	/*
		[ES2019] Returns a string with all whitespace removed from the start of the string.
	*/
	if (!String.prototype.trimStart) {
		Object.defineProperty(String.prototype, 'trimStart', {
			configurable : true,
			writable     : true,

			value() {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.trimStart called on null or undefined');
				}

				return _trimString(this, 'start');
			}
		});
	}

	if (!String.prototype.trimLeft) {
		Object.defineProperty(String.prototype, 'trimLeft', {
			configurable : true,
			writable     : true,

			value() {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.trimLeft called on null or undefined');
				}

				return _trimString(this, 'start');
			}
		});
	}

	/*
		[ES2019] Returns a string with all whitespace removed from the end of the string.
	*/
	if (!String.prototype.trimEnd) {
		Object.defineProperty(String.prototype, 'trimEnd', {
			configurable : true,
			writable     : true,

			value() {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.trimEnd called on null or undefined');
				}

				return _trimString(this, 'end');
			}
		});
	}

	if (!String.prototype.trimRight) {
		Object.defineProperty(String.prototype, 'trimRight', {
			configurable : true,
			writable     : true,

			value() {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.trimRight called on null or undefined');
				}

				return _trimString(this, 'end');
			}
		});
	}
})();


/*
	JavaScript Extensions.
*/
(() => {
	'use strict';

	function _nativeMathRandom(useMath) {
		if (useMath || !State.prng.isEnabled()) return Math.random();
		return State.random();
	}


	/*******************************************************************************************************************
		Utility Functions.
	*******************************************************************************************************************/
	/*
		Returns a pseudo-random whole number (integer) within the given bounds.
	*/
	function _random(/* [min ,] max, [useMath] */) {
		let min = 0;
		let max;
		let useMath = false;

		switch (arguments.length) {
		case 0:
			throw new Error('_random called with insufficient parameters');
		case 1:
			max = arguments[0];
			break;
		case 2:
			if (arguments[1] === true) {
				max = arguments[0];
				useMath = arguments[1];
			}
			else {
				min = arguments[0];
				max = arguments[1];
			}
			break;
		default:
			min = arguments[0];
			max = arguments[1];
			useMath = arguments[2];
			break;
		}

		if (min > max) {
			[min, max] = [max, min];
		}

		return Math.floor(_nativeMathRandom(useMath) * (max - min + 1)) + min;
	}

	/*
		[DEPRECATED]
		Returns a randomly selected index within the given length and bounds.
		Bounds may be negative.
	*/
	function _randomIndex(length, boundsArgs) {
		let min;
		let max;

		switch (boundsArgs.length) {
		case 1:
			min = 0;
			max = length - 1;
			break;
		case 2:
			min = 0;
			max = Math.trunc(boundsArgs[1]);
			break;
		default:
			min = Math.trunc(boundsArgs[1]);
			max = Math.trunc(boundsArgs[2]);
			break;
		}

		if (Number.isNaN(min)) {
			min = 0;
		}
		else if (!Number.isFinite(min) || min >= length) {
			min = length - 1;
		}
		else if (min < 0) {
			min = length + min;

			if (min < 0) {
				min = 0;
			}
		}

		if (Number.isNaN(max)) {
			max = 0;
		}
		else if (!Number.isFinite(max) || max >= length) {
			max = length - 1;
		}
		else if (max < 0) {
			max = length + max;

			if (max < 0) {
				max = length - 1;
			}
		}

		return _random(min, max);
	}

	/*
		Returns an object (`{ char, start, end }`) containing the Unicode character at
		position `pos`, its starting position, and its ending position—surrogate pairs
		are properly handled.  If `pos` is out-of-bounds, returns an object containing
		the empty string and start/end positions of `-1`.

		This function is necessary because JavaScript strings are sequences of UTF-16
		code units, so surrogate pairs are exposed and thus must be handled.  While the
		ES6/2015 standard does improve the situation somewhat, it does not alleviate
		the need for this function.

		NOTE: Will throw exceptions on invalid surrogate pairs.

		IDEA: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/charAt
	*/
	function _getCodePointStartAndEnd(str, pos) {
		const code = str.charCodeAt(pos);

		// Given position was out-of-bounds.
		if (Number.isNaN(code)) {
			return { char : '', start : -1, end : -1 };
		}

		// Code unit is not a UTF-16 surrogate.
		if (code < 0xD800 || code > 0xDFFF) {
			return {
				char  : str.charAt(pos),
				start : pos,
				end   : pos
			};
		}

		// Code unit is a high surrogate (D800–DBFF).
		if (code >= 0xD800 && code <= 0xDBFF) {
			const nextPos = pos + 1;

			// End of string.
			if (nextPos >= str.length) {
				throw new Error('high surrogate without trailing low surrogate');
			}

			const nextCode = str.charCodeAt(nextPos);

			// Next code unit is not a low surrogate (DC00–DFFF).
			if (nextCode < 0xDC00 || nextCode > 0xDFFF) {
				throw new Error('high surrogate without trailing low surrogate');
			}

			return {
				char  : str.charAt(pos) + str.charAt(nextPos),
				start : pos,
				end   : nextPos
			};
		}

		// Code unit is a low surrogate (DC00–DFFF) in the first position.
		if (pos === 0) {
			throw new Error('low surrogate without leading high surrogate');
		}

		const prevPos  = pos - 1;
		const prevCode = str.charCodeAt(prevPos);

		// Previous code unit is not a high surrogate (D800–DBFF).
		if (prevCode < 0xD800 || prevCode > 0xDBFF) {
			throw new Error('low surrogate without leading high surrogate');
		}

		return {
			char  : str.charAt(prevPos) + str.charAt(pos),
			start : prevPos,
			end   : pos
		};
	}


	/*******************************************************************************************************************
		Extensions, General.
	*******************************************************************************************************************/
	/*
		Randomly selects an element from the given array, or array-like object, and returns it.
	*/
	Object.defineProperty(Array, 'random', {
		configurable : true,
		writable     : true,

		value(array, useMath) {
			if (
				   typeof array !== 'object'
				|| array === null
				|| !Object.prototype.hasOwnProperty.call(array, 'length')
			) {
				throw new TypeError('Array.random array parameter must be an array or array-lke object');
			}

			const length = array.length >>> 0;

			if (length === 0) {
				return;
			}

			const index = _random(0, length - 1, useMath);

			return array[index];
		}
	});

	/*
		Concatenates one or more unique elements to the end of the base array
		and returns the result as a new array.  Elements which are arrays will
		be merged—i.e. their elements will be concatenated, rather than the
		array itself.
	*/
	Object.defineProperty(Array.prototype, 'concatUnique', {
		configurable : true,
		writable     : true,

		value(/* variadic */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.concatUnique called on null or undefined');
			}

			const result = Array.from(this);

			if (arguments.length === 0) {
				return result;
			}

			const items   = Array.prototype.reduce.call(arguments, (prev, cur) => prev.concat(cur), []);
			const addSize = items.length;

			if (addSize === 0) {
				return result;
			}

			const indexOf = Array.prototype.indexOf;
			const push    = Array.prototype.push;

			for (let i = 0; i < addSize; ++i) {
				const value = items[i];

				if (indexOf.call(result, value) === -1) {
					push.call(result, value);
				}
			}

			return result;
		}
	});

	/*
		Returns the number of times the given element was found within the array.
	*/
	Object.defineProperty(Array.prototype, 'count', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex ] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.count called on null or undefined');
			}

			const indexOf = Array.prototype.indexOf;
			const needle  = arguments[0];
			let pos   = Number(arguments[1]) || 0;
			let count = 0;

			while ((pos = indexOf.call(this, needle, pos)) !== -1) {
				++count;
				++pos;
			}

			return count;
		}
	});

	/*
		Returns the number elements within the array that pass the test
		implemented by the given predicate function.
	*/
	Object.defineProperty(Array.prototype, 'countWith', {
		configurable : true,
		writable     : true,

		value(predicate, thisArg) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.countWith called on null or undefined');
			}
			if (typeof predicate !== 'function') {
				throw new Error('Array.prototype.countWith predicate parameter must be a function');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return 0;
			}

			let count = 0;

			for (let i = 0; i < length; ++i) {
				if (predicate.call(thisArg, this[i], i, this)) {
					++count;
				}
			}

			return count;
		}
	});

	/*
		Removes and returns all of the given elements from the array.
	*/
	Object.defineProperty(Array.prototype, 'delete', {
		configurable : true,
		writable     : true,

		value(/* needles */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.delete called on null or undefined');
			}

			if (arguments.length === 0) {
				return [];
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return [];
			}

			const needles       = Array.prototype.concat.apply([], arguments);
			const needlesLength = needles.length;
			const indices       = [];

			for (let i = 0; i < length; ++i) {
				const value = this[i];

				for (let j = 0; j < needlesLength; ++j) {
					const needle = needles[j];

					if (value === needle || value !== value && needle !== needle) {
						indices.push(i);
						break;
					}
				}
			}

			const result = [];

			// Copy the elements (in original order).
			for (let i = 0, iend = indices.length; i < iend; ++i) {
				result[i] = this[indices[i]];
			}

			const splice = Array.prototype.splice;

			// Delete the elements (in reverse order).
			for (let i = indices.length - 1; i >= 0; --i) {
				splice.call(this, indices[i], 1);
			}

			return result;
		}
	});

	/*
		Removes and returns all of the elements at the given indices from the array.
	*/
	Object.defineProperty(Array.prototype, 'deleteAt', {
		configurable : true,
		writable     : true,

		value(/* indices */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.deleteAt called on null or undefined');
			}

			if (arguments.length === 0) {
				return [];
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return [];
			}

			const splice     = Array.prototype.splice;
			const cpyIndices = [
				...new Set(
					Array.prototype.concat.apply([], arguments)
						// Map negative indices to their positive counterparts,
						// so the Set can properly filter out duplicates.
						.map(x => x < 0 ? Math.max(0, length + x) : x)
				).values()
			];
			const delIndices = [...cpyIndices].sort((a, b) => b - a);
			const result     = [];

			// Copy the elements (in originally specified order).
			for (let i = 0, iend = cpyIndices.length; i < iend; ++i) {
				result[i] = this[cpyIndices[i]];
			}

			// Delete the elements (in descending numeric order).
			for (let i = 0, iend = delIndices.length; i < iend; ++i) {
				splice.call(this, delIndices[i], 1);
			}

			return result;
		}
	});

	/*
		Removes and returns all of the elements that pass the test implemented
		by the given predicate function from the array.
	*/
	Object.defineProperty(Array.prototype, 'deleteWith', {
		configurable : true,
		writable     : true,

		value(predicate, thisArg) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.deleteWith called on null or undefined');
			}
			if (typeof predicate !== 'function') {
				throw new Error('Array.prototype.deleteWith predicate parameter must be a function');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return [];
			}

			const splice  = Array.prototype.splice;
			const indices = [];
			const result  = [];

			// Copy the elements (in original order).
			for (let i = 0; i < length; ++i) {
				if (predicate.call(thisArg, this[i], i, this)) {
					result.push(this[i]);
					indices.push(i);
				}
			}

			// Delete the elements (in reverse order).
			for (let i = indices.length - 1; i >= 0; --i) {
				splice.call(this, indices[i], 1);
			}

			return result;
		}
	});

	/*
		Returns the first element from the array.
	*/
	Object.defineProperty(Array.prototype, 'first', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.first called on null or undefined');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return;
			}

			return this[0];
		}
	});

	/*
		Returns whether all of the given elements were found within the array.
	*/
	Object.defineProperty(Array.prototype, 'includesAll', {
		configurable : true,
		writable     : true,

		value(/* needles */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.includesAll called on null or undefined');
			}

			if (arguments.length === 1) {
				if (Array.isArray(arguments[0])) {
					return Array.prototype.includesAll.apply(this, arguments[0]);
				}

				return Array.prototype.includes.apply(this, arguments);
			}

			for (let i = 0, iend = arguments.length; i < iend; ++i) {
				if (
					!Array.prototype.some.call(this, function (val) {
						return val === this.val || val !== val && this.val !== this.val;
					}, { val : arguments[i] })
				) {
					return false;
				}
			}

			return true;
		}
	});

	/*
		Returns whether any of the given elements were found within the array.
	*/
	Object.defineProperty(Array.prototype, 'includesAny', {
		configurable : true,
		writable     : true,

		value(/* needles */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.includesAny called on null or undefined');
			}

			if (arguments.length === 1) {
				if (Array.isArray(arguments[0])) {
					return Array.prototype.includesAny.apply(this, arguments[0]);
				}

				return Array.prototype.includes.apply(this, arguments);
			}

			for (let i = 0, iend = arguments.length; i < iend; ++i) {
				if (
					Array.prototype.some.call(this, function (val) {
						return val === this.val || val !== val && this.val !== this.val;
					}, { val : arguments[i] })
				) {
					return true;
				}
			}

			return false;
		}
	});

	/*
		Returns the last element from the array.
	*/
	Object.defineProperty(Array.prototype, 'last', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.last called on null or undefined');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return;
			}

			return this[length - 1];
		}
	});

	/*
		Randomly removes an element from the base array and returns it.
	*/
	Object.defineProperty(Array.prototype, 'pluck', {
		configurable : true,
		writable     : true,

		value(useMath) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.pluck called on null or undefined');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return;
			}

			const index = _random(0, length - 1, useMath);

			return Array.prototype.splice.call(this, index, 1)[0];
		}
	});

	/*
		Randomly removes the given number of unique elements from the base array
		and returns the removed elements as a new array.
	*/
	Object.defineProperty(Array.prototype, 'pluckMany', {
		configurable : true,
		writable     : true,

		value(wantSize) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.pluckMany called on null or undefined');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return [];
			}

			let want = Math.trunc(wantSize);

			if (!Number.isInteger(want)) {
				throw new Error('Array.prototype.pluckMany want parameter must be an integer');
			}

			if (want < 1) {
				return [];
			}

			if (want > length) {
				want = length;
			}

			const splice = Array.prototype.splice;
			const result = [];
			let max = length - 1;

			do {
				result.push(splice.call(this, _random(0, max--), 1)[0]);
			} while (result.length < want);

			return result;
		}
	});

	/*
		Appends one or more unique elements to the end of the base array and
		returns its new length.
	*/
	Object.defineProperty(Array.prototype, 'pushUnique', {
		configurable : true,
		writable     : true,

		value(/* variadic */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.pushUnique called on null or undefined');
			}

			const addSize = arguments.length;

			if (addSize === 0) {
				return this.length >>> 0;
			}

			const indexOf = Array.prototype.indexOf;
			const push    = Array.prototype.push;

			for (let i = 0; i < addSize; ++i) {
				const value = arguments[i];

				if (indexOf.call(this, value) === -1) {
					push.call(this, value);
				}
			}

			return this.length >>> 0;
		}
	});

	/*
		Randomly selects an element from the base array and returns it.
	*/
	Object.defineProperty(Array.prototype, 'random', {
		configurable : true,
		writable     : true,

		value(useMath) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.random called on null or undefined');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return;
			}

			const index = _random(0, length - 1, useMath);

			return this[index];
		}
	});

	/*
		Randomly selects the given number of unique elements from the base array
		and returns the selected elements as a new array.
	*/
	Object.defineProperty(Array.prototype, 'randomMany', {
		configurable : true,
		writable     : true,

		value(wantSize) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.randomMany called on null or undefined');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return [];
			}

			let want = Math.trunc(wantSize);

			if (!Number.isInteger(want)) {
				throw new Error('Array.prototype.randomMany want parameter must be an integer');
			}

			if (want < 1) {
				return [];
			}

			if (want > length) {
				want = length;
			}

			const picked = new Map();
			const result = [];
			const max    = length - 1;

			do {
				let i;
				do {
					i = _random(0, max);
				} while (picked.has(i));
				picked.set(i, true);
				result.push(this[i]);
			} while (result.length < want);

			return result;
		}
	});

	/*
		Randomly shuffles the array and returns it.
	*/
	Object.defineProperty(Array.prototype, 'shuffle', {
		configurable : true,
		writable     : true,

		value(useMath) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.shuffle called on null or undefined');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return this;
			}

			for (let i = length - 1; i > 0; --i) {
				const j = Math.floor(_nativeMathRandom(useMath) * (i + 1));

				if (i === j) {
					continue;
				}

				// [this[i], this[j]] = [this[j], this[i]];
				const swap = this[i];
				this[i] = this[j];
				this[j] = swap;
			}

			return this;
		}
	});

	/*
		Prepends one or more unique elements to the beginning of the base array
		and returns its new length.
	*/
	Object.defineProperty(Array.prototype, 'unshiftUnique', {
		configurable : true,
		writable     : true,

		value(/* variadic */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.unshiftUnique called on null or undefined');
			}

			const addSize = arguments.length;

			if (addSize === 0) {
				return this.length >>> 0;
			}

			const indexOf = Array.prototype.indexOf;
			const unshift = Array.prototype.unshift;

			for (let i = 0; i < addSize; ++i) {
				const value = arguments[i];

				if (indexOf.call(this, value) === -1) {
					unshift.call(this, value);
				}
			}

			return this.length >>> 0;
		}
	});

	/*
		Returns a bound function that supplies the given arguments to the base
		function, followed by the arguments are supplied to the bound function,
		whenever it is called.
	*/
	Object.defineProperty(Function.prototype, 'partial', {
		configurable : true,
		writable     : true,

		value(/* variadic */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Function.prototype.partial called on null or undefined');
			}

			const slice = Array.prototype.slice;
			const fn    = this;
			const bound = slice.call(arguments, 0);

			return function () {
				const applied = [];
				let argc = 0;

				for (let i = 0; i < bound.length; ++i) {
					applied.push(bound[i] === undefined ? arguments[argc++] : bound[i]);
				}

				return fn.apply(this, applied.concat(slice.call(arguments, argc)));
			};
		}
	});

	/*
		Returns the given numerical clamped to the specified bounds.
	*/
	Object.defineProperty(Math, 'clamp', {
		configurable : true,
		writable     : true,

		value(num, min, max) {
			const value = Number(num);
			return Number.isNaN(value) ? NaN : value.clamp(min, max);
		}
	});

	/*
		Returns a decimal number eased from 0 to 1.

		NOTE: The magnitude of the returned value decreases if num < 0.5 or increases if num > 0.5.
	*/
	Object.defineProperty(Math, 'easeInOut', {
		configurable : true,
		writable     : true,

		value(num) {
			return 1 - (Math.cos(Number(num) * Math.PI) + 1) / 2;
		}
	});

	/*
		Returns the number clamped to the specified bounds.
	*/
	Object.defineProperty(Number.prototype, 'clamp', {
		configurable : true,
		writable     : true,

		value(/* min, max */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Number.prototype.clamp called on null or undefined');
			}

			if (arguments.length !== 2) {
				throw new Error('Number.prototype.clamp called with an incorrect number of parameters');
			}

			let min = Number(arguments[0]);
			let max = Number(arguments[1]);

			if (min > max) {
				[min, max] = [max, min];
			}

			return Math.min(Math.max(this, min), max);
		}
	});

	/*
		Returns a copy of the given string with all RegExp metacharacters escaped.
	*/
	if (!RegExp.escape) {
		(() => {
			const _regExpMetaCharsRe    = /[\\^$*+?.()|[\]{}]/g;
			const _hasRegExpMetaCharsRe = new RegExp(_regExpMetaCharsRe.source); // to drop the global flag

			Object.defineProperty(RegExp, 'escape', {
				configurable : true,
				writable     : true,

				value(str) {
					const val = String(str);
					return val && _hasRegExpMetaCharsRe.test(val)
						? val.replace(_regExpMetaCharsRe, '\\$&')
						: val;
				}
			});
		})();
	}

	/*
		Returns a formatted string, after replacing each format item in the given
		format string with the text equivalent of the corresponding argument's value.
	*/
	(() => {
		const _formatRegExp    = /{(\d+)(?:,([+-]?\d+))?}/g;
		const _hasFormatRegExp = new RegExp(_formatRegExp.source); // to drop the global flag

		Object.defineProperty(String, 'format', {
			configurable : true,
			writable     : true,

			value(format) {
				function padString(str, align, pad) {
					if (!align) {
						return str;
					}

					const plen = Math.abs(align) - str.length;

					if (plen < 1) {
						return str;
					}

					// const padding = Array(plen + 1).join(pad);
					const padding = String(pad).repeat(plen);
					return align < 0 ? str + padding : padding + str;
				}

				if (arguments.length < 2) {
					return arguments.length === 0 ? '' : format;
				}

				const args = arguments.length === 2 && Array.isArray(arguments[1])
					? [...arguments[1]]
					: Array.prototype.slice.call(arguments, 1);

				if (args.length === 0) {
					return format;
				}

				if (!_hasFormatRegExp.test(format)) {
					return format;
				}

				// Possibly required by some old buggy browsers.
				_formatRegExp.lastIndex = 0;

				return format.replace(_formatRegExp, (match, index, align) => {
					let retval = args[index];

					if (retval == null) { // lazy equality for null
						return '';
					}

					while (typeof retval === 'function') {
						retval = retval();
					}

					switch (typeof retval) {
					case 'string': /* no-op */ break;
					case 'object': retval = JSON.stringify(retval); break;
					default:       retval = String(retval); break;
					}

					return padString(retval, !align ? 0 : Number.parseInt(align, 10), ' ');
				});
			}
		});
	})();

	/*
		Returns whether the given string was found within the string.
	*/
	Object.defineProperty(String.prototype, 'contains', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.contains called on null or undefined');
			}

			return String.prototype.indexOf.apply(this, arguments) !== -1;
		}
	});

	/*
		Returns the number of times the given substring was found within the string.
	*/
	Object.defineProperty(String.prototype, 'count', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex ] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.count called on null or undefined');
			}

			const needle = String(arguments[0] || '');

			if (needle === '') {
				return 0;
			}

			const indexOf = String.prototype.indexOf;
			const step    = needle.length;
			let pos     = Number(arguments[1]) || 0;
			let count   = 0;

			while ((pos = indexOf.call(this, needle, pos)) !== -1) {
				++count;
				pos += step;
			}

			return count;
		}
	});

	/*
		Returns the first Unicode code point from the string.
	*/
	Object.defineProperty(String.prototype, 'first', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.first called on null or undefined');
			}

			// Required as `this` could be a `String` object or come from a `call()` or `apply()`.
			const str = String(this);

			// Get the first code point—may be one or two code units—and its end position.
			const { char } = _getCodePointStartAndEnd(str, 0);

			return char;
		}
	});

	/*
		Returns the last Unicode code point from the string.
	*/
	Object.defineProperty(String.prototype, 'last', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.last called on null or undefined');
			}

			// Required as `this` could be a `String` object or come from a `call()` or `apply()`.
			const str = String(this);

			// Get the last code point—may be one or two code units—and its end position.
			const { char } = _getCodePointStartAndEnd(str, str.length - 1);

			return char;
		}
	});

	/*
		Returns a copy of the base string with `delCount` characters replaced with
		`replacement`, starting at `startAt`.
	*/
	Object.defineProperty(String.prototype, 'splice', {
		configurable : true,
		writable     : true,

		value(startAt, delCount, replacement) {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.splice called on null or undefined');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return '';
			}

			let start = Number(startAt);

			if (!Number.isSafeInteger(start)) {
				start = 0;
			}
			else if (start < 0) {
				start += length;

				if (start < 0) {
					start = 0;
				}
			}

			if (start > length) {
				start = length;
			}

			let count = Number(delCount);

			if (!Number.isSafeInteger(count) || count < 0) {
				count = 0;
			}

			let res = this.slice(0, start);

			if (typeof replacement !== 'undefined') {
				res += replacement;
			}

			if (start + count < length) {
				res += this.slice(start + count);
			}

			return res;
		}
	});

	/*
		Returns an array of strings, split from the string, or an empty array if the
		string is empty.
	*/
	Object.defineProperty(String.prototype, 'splitOrEmpty', {
		configurable : true,
		writable     : true,

		value(/* [ separator [, limit ]] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.splitOrEmpty called on null or undefined');
			}

			// Required as `this` could be a `String` object or come from a `call()` or `apply()`.
			if (String(this) === '') {
				return [];
			}

			return String.prototype.split.apply(this, arguments);
		}
	});

	/*
		Returns a copy of the base string with the first Unicode code point uppercased,
		according to any locale-specific rules.
	*/
	Object.defineProperty(String.prototype, 'toLocaleUpperFirst', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.toLocaleUpperFirst called on null or undefined');
			}

			// Required as `this` could be a `String` object or come from a `call()` or `apply()`.
			const str = String(this);

			// Get the first code point—may be one or two code units—and its end position.
			const { char, end } = _getCodePointStartAndEnd(str, 0);

			return end === -1 ? '' : char.toLocaleUpperCase() + str.slice(end + 1);
		}
	});

	/*
		Returns a copy of the base string with the first Unicode code point uppercased.
	*/
	Object.defineProperty(String.prototype, 'toUpperFirst', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.toUpperFirst called on null or undefined');
			}

			// Required as `this` could be a `String` object or come from a `call()` or `apply()`.
			const str = String(this);

			// Get the first code point—may be one or two code units—and its end position.
			const { char, end } = _getCodePointStartAndEnd(str, 0);

			return end === -1 ? '' : char.toUpperCase() + str.slice(end + 1);
		}
	});


	/*******************************************************************************************************************
		Extensions, JSON.
	*******************************************************************************************************************/
	/*
		Define `toJSON()` methods on each prototype we wish to support.
	*/
	Object.defineProperty(Date.prototype, 'toJSON', {
		configurable : true,
		writable     : true,

		value() {
			return ['(revive:date)', this.toISOString()];
		}
	});
	Object.defineProperty(Function.prototype, 'toJSON', {
		configurable : true,
		writable     : true,

		value() {
			/*
				The enclosing parenthesis here are necessary to force the function expression code
				string, returned by `this.toString()`, to be evaluated as an expression during
				revival.  Without them, the function expression, which is likely nameless, will be
				evaluated as a function definition—which will throw a syntax error exception, since
				function definitions must have a name.
			*/
			return ['(revive:eval)', `(${this.toString()})`];
		}
	});
	Object.defineProperty(Map.prototype, 'toJSON', {
		configurable : true,
		writable     : true,

		value() {
			return ['(revive:map)', [...this]];
		}
	});
	Object.defineProperty(RegExp.prototype, 'toJSON', {
		configurable : true,
		writable     : true,

		value() {
			return ['(revive:eval)', this.toString()];
		}
	});
	Object.defineProperty(Set.prototype, 'toJSON', {
		configurable : true,
		writable     : true,

		value() {
			return ['(revive:set)', [...this]];
		}
	});

	/*
		Utility method to allow users to easily wrap their code in the revive wrapper.
	*/
	Object.defineProperty(JSON, 'reviveWrapper', {
		configurable : true,
		writable     : true,

		value(code, data) {
			if (typeof code !== 'string') {
				throw new TypeError('JSON.reviveWrapper code parameter must be a string');
			}

			return ['(revive:eval)', [code, data]];
		}
	});

	/*
		Backup the original `JSON.stringify()` and replace it with a revive wrapper aware version.
	*/
	Object.defineProperty(JSON, '_real_stringify', {
		value : JSON.stringify
	});
	Object.defineProperty(JSON, 'stringify', {
		configurable : true,
		writable     : true,

		value(value, replacer, space) {
			return JSON._real_stringify(value, (key, val) => {
				let value = val;

				/*
					Call the custom replacer, if specified.
				*/
				if (typeof replacer === 'function') {
					try {
						value = replacer(key, value);
					}
					catch (ex) { /* no-op; although, perhaps, it would be better to throw an error here */ }
				}

				/*
					Attempt to replace values.
				*/
				if (typeof value === 'undefined') value = ['(revive:eval)', 'undefined'];
				else if (value === Infinity) value = ['(revive:eval)', 'Infinity'];
				else if (value === -Infinity) value = ['(revive:eval)', '-Infinity'];
				else if (Number.isNaN(value)) value = ['(revive:eval)', 'NaN'];

				return value;
			}, space);
		}
	});

	/*
		Backup the original `JSON.parse()` and replace it with a revive wrapper aware version.
	*/
	Object.defineProperty(JSON, '_real_parse', {
		value : JSON.parse
	});
	Object.defineProperty(JSON, 'parse', {
		configurable : true,
		writable     : true,

		value(text, reviver) {
			return JSON._real_parse(text, (key, val) => {
				let value = val;

				/*
					Attempt to revive wrapped values.
				*/
				if (Array.isArray(value) && value.length === 2) {
					switch (value[0]) {
					case '(revive:set)':
						value = new Set(value[1]);
						break;
					case '(revive:map)':
						value = new Map(value[1]);
						break;
					case '(revive:date)':
						value = new Date(value[1]);
						break;
					case '(revive:eval)':
						try {
							/* eslint-disable no-eval */
							// For post-v2.9.0 `JSON.reviveWrapper()`.
							if (Array.isArray(value[1])) {
								const $ReviveData$ = value[1][1]; // eslint-disable-line no-unused-vars
								value = eval(value[1][0]);
							}

							// For regular expressions, functions, and pre-v2.9.0 `JSON.reviveWrapper()`.
							else {
								value = eval(value[1]);
							}
							/* eslint-enable no-eval */
						}
						catch (ex) { /* no-op; although, perhaps, it would be better to throw an error here */ }
						break;
					}
				}

				/* legacy */
				else if (typeof value === 'string' && value.slice(0, 10) === '@@revive@@') {
					try {
						value = eval(value.slice(10)); // eslint-disable-line no-eval
					}
					catch (ex) { /* no-op; although, perhaps, it would be better to throw an error here */ }
				}
				/* /legacy */

				/*
					Call the custom reviver, if specified.
				*/
				if (typeof reviver === 'function') {
					try {
						value = reviver(key, value);
					}
					catch (ex) { /* no-op; although, perhaps, it would be better to throw an error here */ }
				}

				return value;
			});
		}
	});


	/*******************************************************************************************************************
		Extensions, Deprecated.
	*******************************************************************************************************************/
	/*
		[DEPRECATED] Returns whether the given element was found within the array.
	*/
	Object.defineProperty(Array.prototype, 'contains', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.contains called on null or undefined');
			}

			return Array.prototype.includes.apply(this, arguments);
		}
	});

	/*
		[DEPRECATED] Returns whether all of the given elements were found within the array.
	*/
	Object.defineProperty(Array.prototype, 'containsAll', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.containsAll called on null or undefined');
			}

			return Array.prototype.includesAll.apply(this, arguments);
		}
	});

	/*
		[DEPRECATED] Returns whether any of the given elements were found within the array.
	*/
	Object.defineProperty(Array.prototype, 'containsAny', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.containsAny called on null or undefined');
			}

			return Array.prototype.includesAny.apply(this, arguments);
		}
	});

	/*
		[DEPRECATED] Returns a new array consisting of the flattened source array.
	*/
	Object.defineProperty(Array.prototype, 'flatten', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.flatten called on null or undefined');
			}

			return Array.prototype.flat.call(this, Infinity);
		}
	});

	/*
		[DEPRECATED] Returns an array of link titles, parsed from the string.

		NOTE: Unused in SugarCube, only included for compatibility.
	*/
	Object.defineProperty(String.prototype, 'readBracketedList', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.readBracketedList called on null or undefined');
			}

			// RegExp groups: Double-square-bracket quoted | Unquoted.
			const re    = new RegExp('(?:\\[\\[((?:\\s|\\S)*?)\\]\\])|([^"\'\\s]\\S*)', 'gm');
			const names = [];
			let match;

			while ((match = re.exec(this)) !== null) {
				if (match[1]) { // double-square-bracket quoted
					names.push(match[1]);
				}
				else if (match[2]) { // unquoted
					names.push(match[2]);
				}
			}

			return names;
		}
	});
})();

/***********************************************************************************************************************

	lib/browser.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

var Browser = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/* eslint-disable max-len */
	const userAgent = navigator.userAgent.toLowerCase();

	const winPhone = userAgent.includes('windows phone');
	const isMobile = Object.freeze({
		Android    : !winPhone && userAgent.includes('android'),
		BlackBerry : /blackberry|bb10/.test(userAgent),
		iOS        : !winPhone && /ip(?:hone|ad|od)/.test(userAgent),
		Opera      : !winPhone && (typeof window.operamini === 'object' || userAgent.includes('opera mini')),
		Windows    : winPhone || /iemobile|wpdesktop/.test(userAgent),

		any() {
			return isMobile.Android || isMobile.BlackBerry || isMobile.iOS || isMobile.Opera || isMobile.Windows;
		}
	});

	const isGecko = !isMobile.Windows && !/khtml|trident|edge/.test(userAgent) && userAgent.includes('gecko');

	const isIE      = !userAgent.includes('opera') && /msie|trident/.test(userAgent);
	const ieVersion = isIE
		? (() => {
			const ver = /(?:msie\s+|rv:)(\d+\.\d)/.exec(userAgent);
			return ver ? Number(ver[1]) : 0;
		})()
		: null;

	// opera <= 12: "opera/9.80 (windows nt 6.1; wow64) presto/2.12.388 version/12.16"
	// opera >= 15: "mozilla/5.0 (windows nt 6.1; wow64) applewebkit/537.36 (khtml, like gecko) chrome/28.0.1500.52 safari/537.36 opr/15.0.1147.130"
	const isOpera      = userAgent.includes('opera') || userAgent.includes(' opr/');
	const operaVersion = isOpera
		? (() => {
			const re  = new RegExp(`${/khtml|chrome/.test(userAgent) ? 'opr' : 'version'}\\/(\\d+\\.\\d+)`);
			const ver = re.exec(userAgent);
			return ver ? Number(ver[1]) : 0;
		})()
		: null;

	const isVivaldi = userAgent.includes('vivaldi');
	/* eslint-enable max-len */

	// Module Exports.
	return Object.freeze({
		userAgent,
		isMobile,
		isGecko,
		isIE,
		ieVersion,
		isOpera,
		operaVersion,
		isVivaldi
	});
})();

/***********************************************************************************************************************

	lib/has.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Browser */

var Has = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*
		NOTE: The aggressive try/catch feature tests are necessitated by implementation
		bugs in various browsers.
	*/

	// Is the `HTMLAudioElement` API available?
	const hasAudioElement = (() => {
		try {
			return typeof document.createElement('audio').canPlayType === 'function';
		}
		catch (ex) { /* no-op */ }

		return false;
	})();

	// Is the `File` API available?
	const hasFile = (() => {
		try {
			return 'Blob' in window &&
				'File' in window &&
				'FileList' in window &&
				'FileReader' in window &&
				(!Browser.isOpera || Browser.operaVersion >= 15);
		}
		catch (ex) { /* no-op */ }

		return false;
	})();

	// Is the `geolocation` API available?
	const hasGeolocation = (() => {
		try {
			return 'geolocation' in navigator &&
				typeof navigator.geolocation.getCurrentPosition === 'function' &&
				typeof navigator.geolocation.watchPosition === 'function';
		}
		catch (ex) { /* no-op */ }

		return false;
	})();

	// Is the `MutationObserver` API available?
	const hasMutationObserver = (() => {
		try {
			return 'MutationObserver' in window &&
				typeof window.MutationObserver === 'function';
		}
		catch (ex) { /* no-op */ }

		return false;
	})();

	// Is the `performance` API available?
	const hasPerformance = (() => {
		try {
			return 'performance' in window &&
				typeof window.performance.now === 'function';
		}
		catch (ex) { /* no-op */ }

		return false;
	})();

	// Is the platform a touch device?
	const hasTouch = (() => {
		try {
			return 'ontouchstart' in window ||
				!!window.DocumentTouch &&
				document instanceof window.DocumentTouch ||
				!!navigator.maxTouchPoints ||
				!!navigator.msMaxTouchPoints;
		}
		catch (ex) { /* no-op */ }

		return false;
	})();

	// Is the transition end event available and by what name?
	const hasTransitionEndEvent = (() => {
		try {
			const teMap = new Map([
				['transition',       'transitionend'],
				['MSTransition',     'msTransitionEnd'],
				['WebkitTransition', 'webkitTransitionEnd'],
				['MozTransition',    'transitionend']
			]);
			const teKeys = [...teMap.keys()];
			const el     = document.createElement('div');

			for (let i = 0; i < teKeys.length; ++i) {
				if (el.style[teKeys[i]] !== undefined) {
					return teMap.get(teKeys[i]);
				}
			}
		}
		catch (ex) { /* no-op */ }

		return false;
	})();

	// Module Exports.
	return Object.freeze({
		audio              : hasAudioElement,
		fileAPI            : hasFile,
		geolocation        : hasGeolocation,
		mutationObserver   : hasMutationObserver,
		performance        : hasPerformance,
		touch              : hasTouch,
		transitionEndEvent : hasTransitionEndEvent
	});
})();

/***********************************************************************************************************************

	lib/visibility.js

	Copyright © 2018–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

var Visibility = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*
		There are two versions of the Page Visibility API: First Edition and, the current,
		Second Edition (i.e. "Level 2").  First Edition is mentioned here only because some
		older browsers implement it, rather than the current specification.

		SEE:
			Second Edition : https://www.w3.org/TR/page-visibility/
			First Edition  : https://www.w3.org/TR/2013/REC-page-visibility-20130514/

		NOTE: Generally, all supported browsers change the visibility state when either switching tabs
		within the browser or minimizing the browser window.  Exceptions are noted below:
			* IE 9 doesn't support either version of the Page Visibility API.
			* Opera 12 (Presto) doesn't change the visibility state when the browser is minimized.
	*/

	// Vendor properties object.
	const vendor = (() => {
		try {
			return Object.freeze([
				// Specification.
				{
					hiddenProperty : 'hidden',          // boolean; historical in 2nd edition
					stateProperty  : 'visibilityState', // string, values: 'hidden', 'visible'; 1st edition had more values
					changeEvent    : 'visibilitychange'
				},

				// `webkit` prefixed: old Blink & WebKit.
				{
					hiddenProperty : 'webkitHidden',
					stateProperty  : 'webkitVisibilityState',
					changeEvent    : 'webkitvisibilitychange'
				},

				// `moz` prefixed: old Gecko, maybe Seamonkey.
				{
					hiddenProperty : 'mozHidden',
					stateProperty  : 'mozVisibilityState',
					changeEvent    : 'mozvisibilitychange'
				},

				// `ms` prefixed: IE 10.
				{
					hiddenProperty : 'msHidden',
					stateProperty  : 'msVisibilityState',
					changeEvent    : 'msvisibilitychange'
				}
			].find(vnd => vnd.hiddenProperty in document));
		}
		catch (ex) { /* no-op */ }

		return undefined;
	})();


	/*******************************************************************************
		API Functions.
	*******************************************************************************/

	function getVendor() {
		return vendor;
	}

	function getVisibility() {
		return vendor && document[vendor.stateProperty] || 'visible';
	}

	function isEnabled() {
		return Boolean(vendor);
	}

	function isHidden() {
		// return Boolean(vendor && document[vendor.stateProperty] === 'hidden');
		return Boolean(vendor && document[vendor.hiddenProperty]); // NOTE: Historical, but probably better for 1st edition.
	}


	/*******************************************************************************
		Module Exports.
	*******************************************************************************/

	return Object.freeze(Object.defineProperties({}, {
		// Functions.
		vendor    : { get : getVendor },
		state     : { get : getVisibility },
		isEnabled : { value : isEnabled },
		isHidden  : { value : isHidden },

		// Properties.
		hiddenProperty : { value : vendor && vendor.hiddenProperty },
		stateProperty  : { value : vendor && vendor.stateProperty },
		changeEvent    : { value : vendor && vendor.changeEvent }
	}));
})();

/***********************************************************************************************************************

	lib/fullscreen.js

	Copyright © 2018–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Browser */

var Fullscreen = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*
		SEE:
			https://fullscreen.spec.whatwg.org
			https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
	*/

	// Vendor properties object.
	const vendor = (() => {
		try {
			return Object.freeze([
				// Specification.
				{
					isEnabled   : 'fullscreenEnabled',
					element     : 'fullscreenElement',
					requestFn   : 'requestFullscreen',
					exitFn      : 'exitFullscreen',
					changeEvent : 'fullscreenchange', // prop: onfullscreenchange
					errorEvent  : 'fullscreenerror'   // prop: onfullscreenerror
				},

				// `webkit` prefixed: old Blink, WebKit, & Edge.
				{
					isEnabled   : 'webkitFullscreenEnabled',
					element     : 'webkitFullscreenElement',
					requestFn   : 'webkitRequestFullscreen',
					exitFn      : 'webkitExitFullscreen',
					changeEvent : 'webkitfullscreenchange',
					errorEvent  : 'webkitfullscreenerror'
				},

				// `moz` prefixed: old Gecko, maybe Seamonkey.
				{
					isEnabled   : 'mozFullScreenEnabled',
					element     : 'mozFullScreenElement',
					requestFn   : 'mozRequestFullScreen',
					exitFn      : 'mozCancelFullScreen',
					changeEvent : 'mozfullscreenchange',
					errorEvent  : 'mozfullscreenerror'
				},

				// `ms` prefixed: IE 11.
				{
					isEnabled   : 'msFullscreenEnabled',
					element     : 'msFullscreenElement',
					requestFn   : 'msRequestFullscreen',
					exitFn      : 'msExitFullscreen',
					changeEvent : 'MSFullscreenChange',
					errorEvent  : 'MSFullscreenError'
				}
			].find(vnd => vnd.isEnabled in document));
		}
		catch (ex) { /* no-op */ }

		return undefined;
	})();


	/*******************************************************************************
		Feature Detection Functions.
	*******************************************************************************/

	// Return whether the request and exit fullscreen methods return a `Promise`.
	//
	// NOTE: The initial result is cached for future calls.
	const _returnsPromise = (function () {
		// Cache of whether the request and exit methods return a `Promise`.
		let _hasPromise = null;

		function _returnsPromise() {
			if (_hasPromise !== null) {
				return _hasPromise;
			}

			_hasPromise = false;

			if (vendor) {
				try {
					const value = document.exitFullscreen();

					// Silence "Uncaught (in promise)" console errors from Blink.
					//
					// NOTE: Swallowing errors is generally bad, but in this case we know there's
					// going to be an error regardless, since we shouldn't be in fullscreen yet,
					// and we don't actually care about the error, since we just want the return
					// value, so we consign it to the bit bucket.
					//
					// NOTE: We don't ensure that the return value is not `undefined` here because
					// having the attempted call to `<Promise>.catch()` on an `undefined` value throw
					// is acceptable, since it will be caught and `false` eventually returned.
					value.catch(() => { /* no-op */ });

					_hasPromise = value instanceof Promise;
				}
				catch (ex) { /* no-op */ }
			}

			return _hasPromise;
		}

		return _returnsPromise;
	})();


	/*******************************************************************************
		Utility Functions.
	*******************************************************************************/

	function _selectElement(requestedEl) {
		let selectedEl = requestedEl || document.documentElement;

		// Document element scrolling workaround for older browsers.
		if (
			   selectedEl === document.documentElement
			&& (
				   vendor.requestFn === 'msRequestFullscreen'   // IE 11
				|| Browser.isOpera && Browser.operaVersion < 15 // Opera 12 (Presto)
			)
		) {
			selectedEl = document.body;
		}

		return selectedEl;
	}


	/*******************************************************************************
		API Functions.
	*******************************************************************************/

	function getVendor() {
		return vendor;
	}

	function getElement() {
		return (vendor || null) && document[vendor.element];
	}

	function isEnabled() {
		return Boolean(vendor && document[vendor.isEnabled]);
	}

	function isFullscreen() {
		return Boolean(vendor && document[vendor.element]);
	}

	function requestFullscreen(options, requestedEl) {
		if (!vendor) {
			return Promise.reject(new Error('fullscreen not supported'));
		}

		const element = _selectElement(requestedEl);

		if (typeof element[vendor.requestFn] !== 'function') {
			return Promise.reject(new Error('fullscreen not supported'));
		}
		if (isFullscreen()) {
			return Promise.resolve();
		}

		if (_returnsPromise()) {
			return element[vendor.requestFn](options);
		}
		else { // eslint-disable-line no-else-return
			const namespace = '.Fullscreen_requestFullscreen';

			return new Promise((resolve, reject) => {
				jQuery(element)
					.off(namespace)
					.one(`${vendor.errorEvent}${namespace} ${vendor.changeEvent}${namespace}`, ev => {
						jQuery(this).off(namespace);

						if (ev.type === vendor.errorEvent) {
							reject(new Error('unknown fullscreen request error'));
						}
						else {
							resolve();
						}
					});
				element[vendor.requestFn](options);
			});
		}
	}

	function exitFullscreen() {
		if (!vendor || typeof document[vendor.exitFn] !== 'function') {
			return Promise.reject(new TypeError('fullscreen not supported'));
		}
		if (!isFullscreen()) {
			return Promise.reject(new TypeError('fullscreen mode not active'));
		}

		if (_returnsPromise()) {
			return document[vendor.exitFn]();
		}
		else { // eslint-disable-line no-else-return
			const namespace = '.Fullscreen_exitFullscreen';

			return new Promise((resolve, reject) => {
				jQuery(document)
					.off(namespace)
					.one(`${vendor.errorEvent}${namespace} ${vendor.changeEvent}${namespace}`, ev => {
						jQuery(this).off(namespace);

						if (ev.type === vendor.errorEvent) {
							reject(new Error('unknown fullscreen exit error'));
						}
						else {
							resolve();
						}
					});
				document[vendor.exitFn]();
			});
		}
	}

	function toggleFullscreen(options, requestedEl) {
		return isFullscreen() ? exitFullscreen() : requestFullscreen(options, requestedEl);
	}

	function onChange(handlerFn, requestedEl) {
		if (!vendor) {
			return;
		}

		const element = _selectElement(requestedEl);

		$(element).on(vendor.changeEvent, handlerFn);
	}

	function offChange(handlerFn, requestedEl) {
		if (!vendor) {
			return;
		}

		const element = _selectElement(requestedEl);

		if (handlerFn) {
			$(element).off(vendor.changeEvent, handlerFn);
		}
		else {
			$(element).off(vendor.changeEvent);
		}
	}

	function onError(handlerFn, requestedEl) {
		if (!vendor) {
			return;
		}

		const element = _selectElement(requestedEl);

		$(element).on(vendor.errorEvent, handlerFn);
	}

	function offError(handlerFn, requestedEl) {
		if (!vendor) {
			return;
		}

		const element = _selectElement(requestedEl);

		if (handlerFn) {
			$(element).off(vendor.errorEvent, handlerFn);
		}
		else {
			$(element).off(vendor.errorEvent);
		}
	}


	/*******************************************************************************
		Module Exports.
	*******************************************************************************/

	return Object.freeze(Object.defineProperties({}, {
		vendor       : { get : getVendor },
		element      : { get : getElement },
		isEnabled    : { value : isEnabled },
		isFullscreen : { value : isFullscreen },
		request      : { value : requestFullscreen },
		exit         : { value : exitFullscreen },
		toggle       : { value : toggleFullscreen },
		onChange     : { value : onChange },
		offChange    : { value : offChange },
		onError      : { value : onError },
		offError     : { value : offError }
	}));
})();

/***********************************************************************************************************************

	lib/helpers.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Config, L10n, State, Story, Util, Wikifier */

var { // eslint-disable-line no-var
	/* eslint-disable no-unused-vars */
	clone,
	convertBreaks,
	safeActiveElement,
	setDisplayTitle,
	setPageElement,
	throwError,
	stringFrom
	/* eslint-enable no-unused-vars */
} = (() => {
	'use strict';


	/*******************************************************************************************************************
		Utility Functions.
	*******************************************************************************************************************/
	function _getTextContent(source) {
		const copy = source.cloneNode(true);
		const frag = document.createDocumentFragment();
		let node;

		while ((node = copy.firstChild) !== null) {
			// Insert spaces before various elements.
			if (node.nodeType === Node.ELEMENT_NODE) {
				switch (node.nodeName.toUpperCase()) {
				case 'BR':
				case 'DIV':
				case 'P':
					frag.appendChild(document.createTextNode(' '));
					break;
				}
			}

			frag.appendChild(node);
		}

		return frag.textContent;
	}


	/*******************************************************************************************************************
		Helper Functions.
	*******************************************************************************************************************/
	/*
		Returns a deep copy of the given object.

		NOTE:
			1. `clone()` does not clone functions, however, since function definitions
			   are immutable, the only issues are with expando properties and scope.
			   The former really should not be done.  The latter is problematic either
			   way—damned if you do, damned if you don't.
			2. `clone()` does not maintain referential relationships—e.g. multiple
			   references to the same object will, post-cloning, refer to different
			   equivalent objects; i.e. each reference will receive its own clone
			   of the original object.
	*/
	function clone(orig) {
		/*
			Immediately return the primitives and functions.
		*/
		if (typeof orig !== 'object' || orig === null) {
			return orig;
		}

		/*
			Unbox instances of the primitive exemplar objects.
		*/
		if (orig instanceof String) {
			return String(orig);
		}
		if (orig instanceof Number) {
			return Number(orig);
		}
		if (orig instanceof Boolean) {
			return Boolean(orig);
		}

		/*
			Honor native clone methods.
		*/
		if (typeof orig.clone === 'function') {
			return orig.clone(true);
		}
		if (orig.nodeType && typeof orig.cloneNode === 'function') {
			return orig.cloneNode(true);
		}

		/*
			Create a copy of the original object.

			NOTE: Each non-generic object that we wish to support must be
			explicitly handled below.
		*/
		let copy;

		// Handle instances of the core supported object types.
		if (orig instanceof Array) {
			copy = new Array(orig.length);
		}
		else if (orig instanceof Date) {
			copy = new Date(orig.getTime());
		}
		else if (orig instanceof Map) {
			copy = new Map();
			orig.forEach((val, key) => copy.set(key, clone(val)));
		}
		else if (orig instanceof RegExp) {
			copy = new RegExp(orig);
		}
		else if (orig instanceof Set) {
			copy = new Set();
			orig.forEach(val => copy.add(clone(val)));
		}

		// Handle instances of unknown or generic objects.
		else {
			// We try to ensure that the returned copy has the same prototype as
			// the original, but this will probably produce less than satisfactory
			// results on non-generics.
			copy = Object.create(Object.getPrototypeOf(orig));
		}

		/*
			Duplicate the original object's own enumerable properties, which will
			include expando properties on non-generic objects.

			NOTE: This preserves neither symbol properties nor ES5 property attributes.
			Neither does the delta coding or serialization code, however, so it's not
			really an issue at the moment.
		*/
		Object.keys(orig).forEach(name => copy[name] = clone(orig[name]));

		return copy;
	}

	/*
		Converts <br> elements to <p> elements within the given node tree.
	*/
	function convertBreaks(source) {
		const output = document.createDocumentFragment();
		let para = document.createElement('p');
		let node;

		while ((node = source.firstChild) !== null) {
			if (node.nodeType === Node.ELEMENT_NODE) {
				const tagName = node.nodeName.toUpperCase();

				switch (tagName) {
				case 'BR':
					if (
						   node.nextSibling !== null
						&& node.nextSibling.nodeType === Node.ELEMENT_NODE
						&& node.nextSibling.nodeName.toUpperCase() === 'BR'
					) {
						source.removeChild(node.nextSibling);
						source.removeChild(node);
						output.appendChild(para);
						para = document.createElement('p');
						continue;
					}
					else if (!para.hasChildNodes()) {
						source.removeChild(node);
						continue;
					}
					break;

				case 'ADDRESS':
				case 'ARTICLE':
				case 'ASIDE':
				case 'BLOCKQUOTE':
				case 'CENTER':
				case 'DIV':
				case 'DL':
				case 'FIGURE':
				case 'FOOTER':
				case 'FORM':
				case 'H1':
				case 'H2':
				case 'H3':
				case 'H4':
				case 'H5':
				case 'H6':
				case 'HEADER':
				case 'HR':
				case 'MAIN':
				case 'NAV':
				case 'OL':
				case 'P':
				case 'PRE':
				case 'SECTION':
				case 'TABLE':
				case 'UL':
					if (para.hasChildNodes()) {
						output.appendChild(para);
						para = document.createElement('p');
					}

					output.appendChild(node);
					continue;
				}
			}

			para.appendChild(node);
		}

		if (para.hasChildNodes()) {
			output.appendChild(para);
		}

		source.appendChild(output);
	}

	/*
		Returns `document.activeElement` or `null`.
	*/
	function safeActiveElement() {
		/*
			IE9 contains a bug where trying to access the active element of an iframe's
			parent document (i.e. `window.parent.document.activeElement`) will throw an
			exception, so we must allow for an exception to be thrown.

			We could simply return `undefined` here, but since the API's default behavior
			should be to return `document.body` or `null` when there is no selection, we
			choose to return `null` in all non-element cases (i.e. whether it returns
			`null` or throws an exception).  Just a bit of normalization.
		*/
		try {
			return document.activeElement || null;
		}
		catch (ex) {
			return null;
		}
	}

	/*
		Sets the display title.
	*/
	function setDisplayTitle(title) {
		if (typeof title !== 'string') {
			throw new TypeError(`story display title must be a string (received: ${Util.getType(title)})`);
		}

		const render = document.createDocumentFragment();
		new Wikifier(render, title);

		const text = _getTextContent(render).trim();

		// if (text === '') {
		// 	throw new Error('story display title must not render to an empty string or consist solely of whitespace');
		// }

		document.title = Config.passages.displayTitles && State.passage !== '' && State.passage !== Config.passages.start
			? `${State.passage} | ${text}`
			: text;

		const storyTitle = document.getElementById('story-title');

		if (storyTitle !== null) {
			jQuery(storyTitle).empty().append(render);
		}
	}

	/*
		Wikifies a passage into a DOM element corresponding to the passed ID and returns the element.
	*/
	function setPageElement(idOrElement, titles, defaultText) {
		const el = typeof idOrElement === 'object'
			? idOrElement
			: document.getElementById(idOrElement);

		if (el == null) { // lazy equality for null
			return null;
		}

		const ids = Array.isArray(titles) ? titles : [titles];

		jQuery(el).empty();

		for (let i = 0, iend = ids.length; i < iend; ++i) {
			if (Story.has(ids[i])) {
				el.append(Story.get(ids[i]).render());
				return el;
			}
		}

		if (defaultText != null) { // lazy equality for null
			const text = String(defaultText).trim();

			if (text !== '') {
				new Wikifier(el, text);
			}
		}

		return el;
	}

	/*
		Appends an error view to the passed DOM element.
	*/
	function throwError(place, message, source, stack) {
		const $wrapper = jQuery(document.createElement('div'));
		const $toggle  = jQuery(document.createElement('button'));
		const $source  = jQuery(document.createElement('pre'));
		const mesg     = `${L10n.get('errorTitle')}: ${message || 'unknown error'} ${Config.saves.version}`;

		$toggle
			.addClass('error-toggle')
			.ariaClick({
				label : L10n.get('errorToggle')
			}, () => {
				if ($toggle.hasClass('enabled')) {
					$toggle.removeClass('enabled');
					$source.attr({
						'aria-hidden' : true,
						hidden        : 'hidden'
					});
				}
				else {
					$toggle.addClass('enabled');
					$source.removeAttr('aria-hidden hidden');
				}
			})
			.appendTo($wrapper);
		jQuery(document.createElement('span'))
			.addClass('error')
			.text(mesg)
			.appendTo($wrapper);
		jQuery(document.createElement('code'))
			.text(source)
			.appendTo($source);
		$source
			.addClass('error-source')
			.attr({
				'aria-hidden' : true,
				hidden        : 'hidden'
			})
			.appendTo($wrapper);
		if (stack) {
			const lines = stack.split('\n');
			for (const ll of lines) {
				const div = document.createElement('div');
				div.append(ll.replace(/file:.*\//, '<path>/'));
				$source.append(div);
			}
		}
		$wrapper
			.addClass('error-view')
			.appendTo(place);

		console.warn(`${mesg}\n\t${source.replace(/\n/g, '\n\t')}`);

		return false;
	}

	/*
		Returns the simple string representation of the given value or, if there is
		none, a square bracketed representation.
	*/
	function stringFrom(value) {
		switch (typeof value) {
		case 'function':
			return '[function]';

		case 'number':
			if (Number.isNaN(value)) {
				return '[number NaN]';
			}

			break;

		case 'object':
			if (value === null) {
				return '[null]';
			}
			else if (value instanceof Array) {
				return value.map(val => stringFrom(val)).join(', ');
			}
			else if (value instanceof Set) {
				return Array.from(value).map(val => stringFrom(val)).join(', ');
			}
			else if (value instanceof Map) {
				const result = Array.from(value).map(([key, val]) => `${stringFrom(key)} \u2192 ${stringFrom(val)}`);
				return `{\u202F${result.join(', ')}\u202F}`;
			}
			else if (value instanceof Date) {
				return value.toLocaleString();
			}
			else if (value instanceof Element) {
				if (
					value === document.documentElement
					|| value === document.head
					|| value === document.body
				) {
					throw new Error('illegal operation; attempting to convert the <html>, <head>, or <body> tags to string is not allowed');
				}

				return value.outerHTML;
			}
			else if (value instanceof Node) {
				return value.textContent;
			}
			else if (typeof value.toString === 'function') {
				return value.toString();
			}

			return Object.prototype.toString.call(value);

		case 'symbol': {
			const desc = typeof value.description !== 'undefined' ? ` "${value.description}"` : '';
			return `[symbol${desc}]`;
		}

		case 'undefined':
			return '[undefined]';
		}

		return String(value);
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		clone             : { value : clone },
		convertBreaks     : { value : convertBreaks },
		safeActiveElement : { value : safeActiveElement },
		setDisplayTitle   : { value : setDisplayTitle },
		setPageElement    : { value : setPageElement },
		throwError        : { value : throwError },
		stringFrom        : { value : stringFrom }
	}));
})();

/***********************************************************************************************************************

	lib/jquery-plugins.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Wikifier, errorPrologRegExp, safeActiveElement */

/*
	WAI-ARIA methods plugin.

	`<jQuery>.ariaClick([options,] handler)`
	    Makes the target element(s) WAI-ARIA compatible clickables.

	`<jQuery>.ariaDisabled(state)`
	    Changes the disabled state of the target WAI-ARIA-compatible clickable element(s).

	`<jQuery>.ariaIsDisabled()`
	    Checks the disabled status of the target WAI-ARIA-compatible clickable element(s).
*/
(() => {
	'use strict';

	/*
		Event handler & utility functions.

		NOTE: Do not replace the anonymous functions herein with arrow functions.
	*/
	function onKeypressFn(ev) {
		// 13 is Enter/Return, 32 is Space.
		if (ev.which === 13 || ev.which === 32) {
			ev.preventDefault();

			// To allow delegation, attempt to trigger the event on `document.activeElement`,
			// if possible, elsewise on `this`.
			jQuery(safeActiveElement() || this).trigger('click');
		}
	}

	function onClickFnWrapper(fn) {
		return function () {
			const $this = jQuery(this);

			const dataPassage = $this.attr('data-passage');
			const initialDataPassage = window && window.SugarCube && window.SugarCube.State && window.SugarCube.State.passage;
			const savedYOffset = window.pageYOffset;

			// Toggle "aria-pressed" status, if the attribute exists.
			if ($this.is('[aria-pressed]')) {
				$this.attr('aria-pressed', $this.attr('aria-pressed') === 'true' ? 'false' : 'true');
			}

			// Call the true handler.
			fn.apply(this, arguments);

			const doJump = () => window.scrollTo(0, savedYOffset);
			if (dataPassage && (window.lastDataPassageLink === dataPassage || initialDataPassage === dataPassage)) {
				if (Config.navigation.rememberYPos && (!V.options || V.options && V.options.scrollRemember !== false)) doJump();
			}
			window.lastDataPassageLink = dataPassage;
		};
	}

	function oneClickFnWrapper(fn) {
		return onClickFnWrapper(function () {
			// Remove both event handlers (keypress & click) and the other components.
			jQuery(this)
				.off('.aria-clickable')
				.removeAttr('role tabindex aria-controls aria-pressed')
				.filter('button')
				.prop('disabled', true);

			// Call the true handler.
			fn.apply(this, arguments);
		});
	}

	jQuery.fn.extend({
		/*
			Extend jQuery's chainable methods with an `ariaClick()` method.
		*/
		ariaClick(options, handler) {
			// Bail out if there are no target element(s) or parameters.
			if (this.length === 0 || arguments.length === 0) {
				return this;
			}

			let opts = options;
			let fn   = handler;

			if (fn == null) { // lazy equality for null
				fn   = opts;
				opts = undefined;
			}

			opts = jQuery.extend({
				namespace : undefined,
				one       : false,
				selector  : undefined,
				data      : undefined,
				role      : undefined,
				controls  : undefined,
				pressed   : undefined,
				label     : undefined
			}, opts);

			if (typeof opts.namespace !== 'string') {
				opts.namespace = '';
			}
			else if (opts.namespace[0] !== '.') {
				opts.namespace = `.${opts.namespace}`;
			}

			if (typeof opts.pressed === 'boolean') {
				opts.pressed = opts.pressed ? 'true' : 'false';
			}

			// Set `type` to `button` to suppress "submit" semantics, for <button> elements.
			this.filter('button').prop('type', 'button');

			// Set `role`.
			if (opts.role != null) { // lazy equality for null
				this.attr('role', opts.role);
			}

			// Elsewise, set `role` to default values based on elements.
			else {
				this
					// Elements without an existing `role`.
					.not('[role]')

					// Elements that are `<a>` OR with `data-passage`.
					.filter('a,[data-passage]')
					.attr('role', 'link')
					.end()

					// Elements that are not `<a>` AND without `data-passage`.
					// WARNING: Do not merge the separate `.not()` instances below.  It is correct as-is.
					.not('a')
					.not('[data-passage]')
					.attr('role', 'button')
					.end()
					.end()

					.end();
			}

			// Set `tabindex` to `0` to make them focusable (unnecessary on <button> elements, but it doesn't hurt).
			this.attr('tabindex', 0);

			// Set `aria-controls`.
			if (opts.controls != null) { // lazy equality for null
				this.attr('aria-controls', opts.controls);
			}

			// Set `aria-pressed`.
			if (opts.pressed != null) { // lazy equality for null
				this.attr('aria-pressed', opts.pressed);
			}

			// Set `aria-label` and `title`.
			if (opts.label != null) { // lazy equality for null
				this.attr({
					'aria-label' : opts.label,
					title        : opts.label
				});
			}

			// Set the keypress handlers, for non-<button> elements.
			// NOTE: For the single-use case, the click handler will also remove this handler.
			this.not('button').on(
				`keypress.aria-clickable${opts.namespace}`,
				opts.selector,
				onKeypressFn
			);

			// Set the click handlers.
			// NOTE: To ensure both handlers are properly removed, `one()` must not be used here.
			this.on(
				`click.aria-clickable${opts.namespace}`,
				opts.selector,
				opts.data,
				opts.one ? oneClickFnWrapper(fn) : onClickFnWrapper(fn)
			);

			// Return `this` for further chaining.
			return this;
		},

		/*
			Extend jQuery's chainable methods with an `ariaDisabled()` method.
		*/
		ariaDisabled(disable) {
			// Bail out if there are no target element(s) or parameters.
			if (this.length === 0 || arguments.length === 0) {
				return this;
			}

			/*
				NOTE: We use `<jQuery>.each()` callbacks to invoke the `<Element>.setAttribute()`
				methods in the following because the `<jQuery>.attr()` method does not allow you
				to set a content attribute without a value, which is recommended for boolean
				content attributes by the HTML specification.
			*/

			const $nonDisableable = this.not('button,fieldset,input,menuitem,optgroup,option,select,textarea');
			const $disableable    = this.filter('button,fieldset,input,menuitem,optgroup,option,select,textarea');

			if (disable) {
				// Add boolean content attribute `disabled` and set non-boolean content attribute
				// `aria-disabled` to `'true'`, for non-disableable elements.
				$nonDisableable.each(function () {
					this.setAttribute('disabled', '');
					this.setAttribute('aria-disabled', 'true');
				});

				// Set IDL attribute `disabled` to `true` and set non-boolean content attribute
				// `aria-disabled` to `'true'`, for disableable elements.
				$disableable.each(function () {
					this.disabled = true;
					this.setAttribute('aria-disabled', 'true');
				});
			}
			else {
				// Remove content attributes `disabled` and `aria-disabled`, for non-disableable elements.
				$nonDisableable.each(function () {
					this.removeAttribute('disabled');
					this.removeAttribute('aria-disabled');
				});

				// Set IDL attribute `disabled` to `false` and remove content attribute `aria-disabled`,
				// for disableable elements.
				$disableable.each(function () {
					this.disabled = false;
					this.removeAttribute('aria-disabled');
				});
			}

			// Return `this` for further chaining.
			return this;
		},

		/*
			Extend jQuery's chainable methods with an `ariaIsDisabled()` method.
		*/
		ariaIsDisabled() {
			// Check content attribute `disabled`.
			//
			// NOTE: We simply check the `disabled` content attribute for all elements
			// since we have to check it for non-disableable elements and it may also
			// be used for disableable elements since their `disabled` IDL attribute
			// is required to reflect the status of their `disabled` content attribute,
			// and vice versa, by the HTML specification.
			// return this.toArray().some(el => el.hasAttribute('disabled'));
			return this.is('[disabled]');
		}
	});
})();

/*
	Wikifier methods plugin.

	`jQuery.wikiWithOptions(options, sources…)`
	    Wikifies the given content source(s), as directed by the given options.

	`jQuery.wiki(sources…)`
	    Wikifies the given content source(s).

	`<jQuery>.wikiWithOptions(options, sources…)`
	    Wikifies the given content source(s) and appends the result to the target
	    element(s), as directed by the given options.

	`<jQuery>.wiki(sources…)`
	    Wikifies the given content source(s) and appends the result to the target
	    element(s).
*/
(() => {
	'use strict';

	jQuery.extend({
		/*
			Extend jQuery's static methods with a `wikiWithOptions()` method.
		*/
		wikiWithOptions(options, ...sources) {
			// Bail out, if there are no content sources.
			if (sources.length === 0) {
				return;
			}

			// Wikify the content sources into a fragment.
			const frag = document.createDocumentFragment();
			sources.forEach(content => new Wikifier(frag, content, options));

			// Gather the text of any error elements within the fragment…
			const errors = [...frag.querySelectorAll('.error')]
				.map(errEl => errEl.textContent.replace(errorPrologRegExp, ''));

			// …and throw an exception, if there were any errors.
			if (errors.length > 0) {
				throw new Error(errors.join('; '));
			}
		},

		/*
			Extend jQuery's static methods with a `wiki()` method.
		*/
		wiki(...sources) {
			this.wikiWithOptions(undefined, ...sources);
		}
	});

	jQuery.fn.extend({
		/*
			Extend jQuery's chainable methods with a `wikiWithOptions()` method.
		*/
		wikiWithOptions(options, ...sources) {
			// Bail out if there are no target element(s) or content sources.
			if (this.length === 0 || sources.length === 0) {
				return this;
			}

			// Wikify the content sources into a fragment.
			const frag = document.createDocumentFragment();
			sources.forEach(content => new Wikifier(frag, content, options));

			// Append the fragment to the target element(s).
			this.append(frag);

			// Return `this` for further chaining.
			return this;
		},

		/*
			Extend jQuery's chainable methods with a `wiki()` method.
		*/
		wiki(...sources) {
			return this.wikiWithOptions(undefined, ...sources);
		}
	});
})();

/***********************************************************************************************************************

	lib/util.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Has, Scripting */

var Util = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
		Type Functions.
	*******************************************************************************************************************/
	/*
		Returns the value yielded by `typeof` (for primitives), the `@@toStringTag`
		internal property (for objects), and `'null'` for `null`.

		NOTE: In ≤ES5, returns the value of the `[[Class]]` internal slot for objects.
	*/
	const utilGetType = (() => {
		// Cache the `<Object>.toString()` method.
		const toString = Object.prototype.toString;

		// If the browser is using the `Map()` and `Set()` polyfills, then return
		// a version of `utilGetType()` that contains special cases for them, since
		// they do not have a `[[Class]]` internal slot and the `@@toStringTag`
		// internal property is unavailable to them.
		if (toString.call(new Map()) === '[object Object]') {
			return function utilGetType(O) {
				if (O === null) { return 'null'; }

				// Special cases for the `Map` and `Set` polyfills.
				//
				// NOTE: We don't special case the `WeakMap` and `WeakSet` polyfills
				// here since they're (a) unlikely to be used and (b) broken anyway.
				if (O instanceof Map) { return 'Map'; }
				if (O instanceof Set) { return 'Set'; }

				const baseType = typeof O;
				return baseType === 'object' ? toString.call(O).slice(8, -1) : baseType;
			};
		}

		// Elsewise, return the regular `utilGetType()` function.
		return function utilGetType(O) {
			if (O === null) { return 'null'; }

			const baseType = typeof O;
			return baseType === 'object' ? toString.call(O).slice(8, -1) : baseType;
		};
	})();

	/*
		Returns whether the passed value is a boolean or one of the strings "true"
		or "false".
	*/
	function utilIsBoolean(obj) {
		return typeof obj === 'boolean' || typeof obj === 'string' && (obj === 'true' || obj === 'false');
	}

	/*
		Returns whether the passed value is iterable.
	*/
	function utilIsIterable(obj) {
		return obj != null && typeof obj[Symbol.iterator] === 'function'; // lazy equality for null
	}

	/*
		Returns whether the passed value is a finite number or a numeric string which
		yields a finite number when parsed.
	*/
	function utilIsNumeric(obj) {
		let num;

		switch (typeof obj) {
		case 'number':
			num = obj;
			break;

		case 'string':
			num = Number(obj);
			break;

		default:
			return false;
		}

		return !Number.isNaN(num) && Number.isFinite(num);
	}

	/*
		Returns whether the passed values pass a SameValueZero comparison.

		SEE: http://ecma-international.org/ecma-262/8.0/#sec-samevaluezero
	*/
	function utilSameValueZero(a, b) {
		/*
			NOTE: This comparison could also be implemented thus:

				```
				a === b ||
				typeof a === 'number' && typeof b === 'number' &&
				Number.isNaN(a) && Number.isNaN(b)
				```

			That's needlessly verbose, however, as `NaN` is the only value in
			the language which is not reflexive.
		*/
		return a === b || a !== a && b !== b;
	}

	/*
		Returns a pseudo-enumeration created from the given Array, Map, Set, or generic object.
	*/
	function utilToEnum(obj) {
		const pEnum = Object.create(null);

		if (obj instanceof Array) {
			obj.forEach((val, i) => pEnum[String(val)] = i);
		}
		else if (obj instanceof Set) {
			// NOTE: Use `<Array>.forEach()` here rather than `<Set>.forEach()`
			// as the latter does not provide the indices we require.
			Array.from(obj).forEach((val, i) => pEnum[String(val)] = i);
		}
		else if (obj instanceof Map) {
			obj.forEach((val, key) => pEnum[String(key)] = val);
		}
		else if (
			   typeof obj === 'object'
			&& obj !== null
			&& Object.getPrototypeOf(obj) === Object.prototype
		) {
			Object.assign(pEnum, obj);
		}
		else {
			throw new TypeError('Util.toEnum obj parameter must be an Array, Map, Set, or generic object');
		}

		return Object.freeze(pEnum);
	}

	/*
		Returns the value of the `@@toStringTag` property of the given object.

		NOTE: In ≤ES5, returns the value of the `[[Class]]` internal slot.
	*/
	function utilToStringTag(obj) {
		return Object.prototype.toString.call(obj).slice(8, -1);
	}


	/*******************************************************************************************************************
		String Encoding Functions.
	*******************************************************************************************************************/
	/*
		Returns a trimmed and encoded slug of the passed string that should be safe
		for use as a DOM ID or class name.

		NOTE: The range of illegal characters consists of: C0 controls, space, exclamation,
		double quote, number, dollar, percent, ampersand, single quote, left paren, right
		paren, asterisk, plus, comma, hyphen, period, forward slash, colon, semi-colon,
		less-than, equals, greater-than, question, at, left bracket, backslash, right
		bracket, caret, backquote/grave, left brace, pipe/vertical-bar, right brace, tilde,
		delete, C1 controls.
	*/
	const _illegalSlugCharsRe = /[\x00-\x20!-/:-@[-^`{-\x9f]+/g; // eslint-disable-line no-control-regex
	/* legacy */
	const _isInvalidSlugRe = /^-*$/; // Matches the empty string or one comprised solely of hyphens.
	/* /legacy */

	function utilSlugify(str) {
		const base = String(str).trim();

		/* legacy */
		const _legacy = base
			.replace(/[^\w\s\u2013\u2014-]+/g, '')
			.replace(/[_\s\u2013\u2014-]+/g, '-')
			.toLocaleLowerCase();

		if (!_isInvalidSlugRe.test(_legacy)) {
			return _legacy;
		}
		/* /legacy */

		return base
			.replace(_illegalSlugCharsRe, '')
			.replace(/[_\s\u2013\u2014-]+/g, '-');

		// For v3.
		// return base.replace(_illegalSlugCharsRe, '-');
	}

	/*
		Returns a sanitized version of the given string that should be safe for use
		as a filename under both Windows and Unix-based/-like operating systems.

		NOTE: The range of illegal characters consists of: C0 controls, double quote,
		number, dollar, percent, ampersand, single quote, asterisk, plus, comma,
		forward slash, colon, semi-colon, less-than, equals, greater-than, question,
		backslash, caret, backquote/grave, pipe/vertical line, delete, C1 controls.
	*/
	const _illegalFilenameCharsRE = /[\x00-\x1f"#$%&'*+,/:;<=>?\\^`|\x7f-\x9f]+/g; // eslint-disable-line no-control-regex

	function utilSanitizeFilename(str) {
		return String(str).trim()
			.replace(_illegalFilenameCharsRE, '');
	}

	/*
		Returns an entity encoded version of the passed string.

		NOTE: Escapes the five primary HTML special characters, the backquote,
		and SugarCube markup metacharacters.
	*/
	const _markupCharsRe    = /[!"#$&'*\-/<=>?@[\\\]^_`{|}~]/g;
	const _hasMarkupCharsRe = new RegExp(_markupCharsRe.source); // to drop the global flag
	const _markupCharsMap   = utilToEnum({
		/* eslint-disable quote-props */
		'!'  : '&#33;',
		'"'  : '&quot;',
		'#'  : '&#35;',
		'$'  : '&#36;',
		'&'  : '&amp;',
		"'"  : '&#39;',
		'*'  : '&#42;',
		'-'  : '&#45;',
		'/'  : '&#47;',
		'<'  : '&lt;',
		'='  : '&#61;',
		'>'  : '&gt;',
		'?'  : '&#63;',
		'@'  : '&#64;',
		'['  : '&#91;',
		'\\' : '&#92;',
		']'  : '&#93;',
		'^'  : '&#94;',
		'_'  : '&#95;',
		'`'  : '&#96;',
		'{'  : '&#123;',
		'|'  : '&#124;',
		'}'  : '&#125;',
		'~'  : '&#126;'
		/* eslint-enable quote-props */
	});

	function utilEscapeMarkup(str) {
		if (str == null) { // lazy equality for null
			return '';
		}

		const val = String(str);
		return val && _hasMarkupCharsRe.test(val)
			? val.replace(_markupCharsRe, ch => _markupCharsMap[ch])
			: val;
	}

	/*
		Returns an entity encoded version of the passed string.

		NOTE: Only escapes the five primary special characters and the backquote.
	*/
	const _htmlCharsRe    = /[&<>"'`]/g;
	const _hasHtmlCharsRe = new RegExp(_htmlCharsRe.source); // to drop the global flag
	const _htmlCharsMap   = utilToEnum({
		'&' : '&amp;',
		'<' : '&lt;',
		'>' : '&gt;',
		'"' : '&quot;',
		"'" : '&#39;',
		'`' : '&#96;'
	});

	function utilEscape(str) {
		if (str == null) { // lazy equality for null
			return '';
		}

		const val = String(str);
		return val && _hasHtmlCharsRe.test(val)
			? val.replace(_htmlCharsRe, ch => _htmlCharsMap[ch])
			: val;
	}

	/*
		Returns a decoded version of the passed entity encoded string.

		NOTE: The extended replacement set here, in contrast to `utilEscape()`,
		is required due to observed stupidity from various sources.
	*/
	const _escapedHtmlRe    = /&(?:amp|#38|#x26|lt|#60|#x3c|gt|#62|#x3e|quot|#34|#x22|apos|#39|#x27|#96|#x60);/gi;
	const _hasEscapedHtmlRe = new RegExp(_escapedHtmlRe.source, 'i'); // to drop the global flag
	const _escapedHtmlMap   = utilToEnum({
		'&amp;'  : '&', // ampersand (HTML character entity, XML predefined entity)
		'&#38;'  : '&', // ampersand (decimal numeric character reference)
		'&#x26;' : '&', // ampersand (hexadecimal numeric character reference)
		'&lt;'   : '<', // less-than (HTML character entity, XML predefined entity)
		'&#60;'  : '<', // less-than (decimal numeric character reference)
		'&#x3c;' : '<', // less-than (hexadecimal numeric character reference)
		'&gt;'   : '>', // greater-than (HTML character entity, XML predefined entity)
		'&#62;'  : '>', // greater-than (decimal numeric character reference)
		'&#x3e;' : '>', // greater-than (hexadecimal numeric character reference)
		'&quot;' : '"', // double quote (HTML character entity, XML predefined entity)
		'&#34;'  : '"', // double quote (decimal numeric character reference)
		'&#x22;' : '"', // double quote (hexadecimal numeric character reference)
		'&apos;' : "'", // apostrophe (XML predefined entity)
		'&#39;'  : "'", // apostrophe (decimal numeric character reference)
		'&#x27;' : "'", // apostrophe (hexadecimal numeric character reference)
		'&#96;'  : '`', // backquote (decimal numeric character reference)
		'&#x60;' : '`'  // backquote (hexadecimal numeric character reference)
	});

	function utilUnescape(str) {
		if (str == null) { // lazy equality for null
			return '';
		}

		const val = String(str);
		return val && _hasEscapedHtmlRe.test(val)
			? val.replace(_escapedHtmlRe, entity => _escapedHtmlMap[entity.toLowerCase()])
			: val;
	}

	/*
		Returns an object (`{ char, start, end }`) containing the Unicode character at
		position `pos`, its starting position, and its ending position—surrogate pairs
		are properly handled.  If `pos` is out-of-bounds, returns an object containing
		the empty string and start/end positions of `-1`.

		This function is necessary because JavaScript strings are sequences of UTF-16
		code units, so surrogate pairs are exposed and thus must be handled.  While the
		ES6/2015 standard does improve the situation somewhat, it does not alleviate
		the need for this function.

		NOTE: Returns the individual code units of invalid surrogate pairs as-is.

		IDEA: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/charAt
	*/
	function utilCharAndPosAt(text, position) {
		const str  = String(text);
		const pos  = Math.trunc(position);
		const code = str.charCodeAt(pos);

		// Given position was out-of-bounds.
		if (Number.isNaN(code)) {
			return { char : '', start : -1, end : -1 };
		}

		const retval = {
			char  : str.charAt(pos),
			start : pos,
			end   : pos
		};

		// Code unit is not a UTF-16 surrogate.
		if (code < 0xD800 || code > 0xDFFF) {
			return retval;
		}

		// Code unit is a high surrogate (D800–DBFF).
		if (code >= 0xD800 && code <= 0xDBFF) {
			const nextPos = pos + 1;

			// End of string.
			if (nextPos >= str.length) {
				return retval;
			}

			const nextCode = str.charCodeAt(nextPos);

			// Next code unit is not a low surrogate (DC00–DFFF).
			if (nextCode < 0xDC00 || nextCode > 0xDFFF) {
				return retval;
			}

			retval.char = retval.char + str.charAt(nextPos);
			retval.end = nextPos;
			return retval;
		}

		// Code unit is a low surrogate (DC00–DFFF) in the first position.
		if (pos === 0) {
			return retval;
		}

		const prevPos  = pos - 1;
		const prevCode = str.charCodeAt(prevPos);

		// Previous code unit is not a high surrogate (D800–DBFF).
		if (prevCode < 0xD800 || prevCode > 0xDBFF) {
			return retval;
		}

		retval.char = str.charAt(prevPos) + retval.char;
		retval.start = prevPos;
		return retval;
	}


	/*******************************************************************************************************************
		Time Functions.
	*******************************************************************************************************************/
	/*
		Returns the number of milliseconds elapsed since a reference epoch.

		NOTE: Use the Performance API, if available, elsewise use Date as a
		failover.  The Performance API is preferred for its monotonic clock—
		meaning, it's not subject to the vagaries of timezone changes and leap
		periods, as is Date.
	*/
	const _nowSource = Has.performance ? performance : Date;

	function utilNow() {
		return _nowSource.now();
	}


	/*******************************************************************************************************************
		Conversion Functions.
	*******************************************************************************************************************/
	/*
		Returns the number of miliseconds represented by the passed CSS time string.
	*/
	const _cssTimeRe = /^([+-]?(?:\d*\.)?\d+)([Mm]?[Ss])$/;

	function utilFromCssTime(cssTime) {
		const match = _cssTimeRe.exec(String(cssTime));

		if (match === null) {
			throw new SyntaxError(`invalid time value syntax: "${cssTime}"`);
		}

		let msec = Number(match[1]);

		if (match[2].length === 1) {
			msec *= 1000;
		}

		if (Number.isNaN(msec) || !Number.isFinite(msec)) {
			throw new RangeError(`invalid time value: "${cssTime}"`);
		}

		return msec;
	}

	/*
		Returns the CSS time string represented by the passed number of milliseconds.
	*/
	function utilToCssTime(msec) {
		if (typeof msec !== 'number' || Number.isNaN(msec) || !Number.isFinite(msec)) {
			let what;

			switch (typeof msec) {
			case 'string':
				what = `"${msec}"`;
				break;

			case 'number':
				what = String(msec);
				break;

			default:
				what = utilToStringTag(msec);
				break;
			}

			throw new Error(`invalid milliseconds: ${what}`);
		}

		return `${msec}ms`;
	}

	/*
		Returns the DOM property name represented by the passed CSS property name.
	*/
	function utilFromCssProperty(cssName) {
		if (!cssName.includes('-')) {
			switch (cssName) {
			case 'bgcolor': return 'backgroundColor';
			case 'float':   return 'cssFloat';
			default:        return cssName;
			}
		}

		// Strip the leading hyphen from the `-ms-` vendor prefix, so it stays lowercased.
		const normalized = cssName.slice(0, 4) === '-ms-' ? cssName.slice(1) : cssName;

		return normalized
			.split('-')
			.map((part, i) => i === 0 ? part : part.toUpperFirst())
			.join('');
	}

	/*
		Returns an object containing the component properties parsed from the passed URL.
	*/
	function utilParseUrl(url) {
		const el       = document.createElement('a');
		const queryObj = Object.create(null);

		// Let the `<a>` element parse the URL.
		el.href = url;

		// Populate the `queryObj` object with the query string attributes.
		if (el.search) {
			el.search
				.replace(/^\?/, '')
				.splitOrEmpty(/(?:&(?:amp;)?|;)/)
				.forEach(query => {
					const [key, value] = query.split('=');
					queryObj[key] = value;
				});
		}

		/*
			Caveats by browser:
				Edge and Internet Explorer (≥8) do not support authentication
				information within a URL at all and will throw a security exception
				on *any* property access if it's included.

				Internet Explorer does not include the leading forward slash on
				`pathname` when required.

				Opera (Presto) strips the authentication information from `href`
				and does not supply `username` or `password`.

				Safari (ca. v5.1.x) does not supply `username` or `password` and
				peforms URI decoding on `pathname`.
		*/

		// Patch for IE not including the leading slash on `pathname` when required.
		const pathname = el.host && el.pathname[0] !== '/' ? `/${el.pathname}` : el.pathname;

		return {
			// The full URL that was originally parsed.
			href : el.href,

			// The request protocol, lowercased.
			protocol : el.protocol,

			// // The full authentication information.
			// auth : el.username || el.password // eslint-disable-line no-nested-ternary
			// 	? `${el.username}:${el.password}`
			// 	: typeof el.username === 'string' ? '' : undefined,
			//
			// // The username portion of the auth info.
			// username : el.username,
			//
			// // The password portion of the auth info.
			// password : el.password,

			// The full host information, including port number, lowercased.
			host : el.host,

			// The hostname portion of the host info, lowercased.
			hostname : el.hostname,

			// The port number portion of the host info.
			port : el.port,

			// The full path information, including query info.
			path : `${pathname}${el.search}`,

			// The pathname portion of the path info.
			pathname,

			// The query string portion of the path info, including the leading question mark.
			query  : el.search,
			search : el.search,

			// The attributes portion of the query string, parsed into an object.
			queries  : queryObj,
			searches : queryObj,

			// The fragment string, including the leading hash/pound sign.
			hash : el.hash
		};
	}

	/*
		Returns a new exception based on the given exception.

		NOTE: Mostly useful for making a standard JavaScript exception type copy
		of a host exception type—e.g. `DOMException` → `Error`.
	*/
	function utilNewExceptionFrom(original, exceptionType, override) {
		if (typeof original !== 'object' || original === null) {
			throw new Error('Util.newExceptionFrom original parameter must be an object');
		}
		if (typeof exceptionType !== 'function') {
			throw new Error('Util.newExceptionFrom exceptionType parameter must be an error type constructor');
		}

		const ex = new exceptionType(original.message); // eslint-disable-line new-cap

		if (typeof original.name !== 'undefined') {
			ex.name = original.name;
		}
		if (typeof original.code !== 'undefined') {
			ex.code = original.code;
		}
		if (typeof original.columnNumber !== 'undefined') {
			ex.columnNumber = original.columnNumber;
		}
		if (typeof original.description !== 'undefined') {
			ex.description = original.description;
		}
		if (typeof original.fileName !== 'undefined') {
			ex.fileName = original.fileName;
		}
		if (typeof original.lineNumber !== 'undefined') {
			ex.lineNumber = original.lineNumber;
		}
		if (typeof original.number !== 'undefined') {
			ex.number = original.number;
		}
		if (typeof original.stack !== 'undefined') {
			ex.stack = original.stack;
		}

		const overrideType = typeof override;

		if (overrideType !== 'undefined') {
			if (overrideType === 'object' && override !== null) {
				Object.assign(ex, override);
			}
			else if (overrideType === 'string') {
				ex.message = override;
			}
			else {
				throw new Error('Util.newExceptionFrom override parameter must be an object or string');
			}
		}

		return ex;
	}

	/*
		Returns a sanitized version of the passed `KeyboardEvent.key` value from
		previous incarnations of the specification that should better reflect the
		current incarnation.
	*/
	const utilScrubEventKey = (() => {
		let separatorKey;
		let decimalKey;

		// Attempt to determine the player's 'Separator' and 'Decimal' key values
		// based on their current locale.
		if (typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function') {
			const match = new Intl.NumberFormat().format(111111.5).match(/(\D*)\d+(\D*)/);

			if (match) {
				separatorKey = match[1];
				decimalKey   = match[2];
			}
		}

		// Failover to US-centric values, if using `Intl.NumberFormat` failed.
		if (!separatorKey && !decimalKey) {
			separatorKey = ',';
			decimalKey   = '.';
		}

		// Maps older `KeyboardEvent.key` values to more current/correct ones.
		function utilScrubEventKey(key) {
			switch (key) {
			// case 'OS':                 return 'Meta'; // Unreliable.
			case 'Scroll':             return 'ScrollLock';
			case 'Spacebar':           return '\x20';
			case 'Left':               return 'ArrowLeft';
			case 'Right':              return 'ArrowRight';
			case 'Up':                 return 'ArrowUp';
			case 'Down':               return 'ArrowDown';
			case 'Del':                return 'Delete';
			case 'Crsel':              return 'CrSel';
			case 'Exsel':              return 'ExSel';
			case 'Esc':                return 'Escape';
			case 'Apps':               return 'ContextMenu';
			case 'Nonconvert':         return 'NonConvert';
			case 'MediaNextTrack':     return 'MediaTrackNext';
			case 'MediaPreviousTrack': return 'MediaTrackPrevious';
			case 'VolumeUp':           return 'AudioVolumeUp';
			case 'VolumeDown':         return 'AudioVolumeDown';
			case 'VolumeMute':         return 'AudioVolumeMute';
			case 'Zoom':               return 'ZoomToggle';
			case 'SelectMedia':        /* see below */
			case 'MediaSelect':        return 'LaunchMediaPlayer';
			case 'Add':                return '+';
			case 'Divide':             return '/';
			case 'Multiply':           return '*';
			case 'Subtract':           return '-';
			case 'Decimal':            return decimalKey;
			case 'Separator':          return separatorKey;
			}

			return key;
		}

		return utilScrubEventKey;
	})();


	/*******************************************************************************************************************
		Browser API Functions.
	*******************************************************************************************************************/
	/*
		Returns whether the given media query matches.
	*/
	const utilHasMediaQuery = (() => {
		// If the browser does not support `matchMedia()`, then return
		// a version of `utilHasMediaQuery()` that simply returns `false`.
		if (typeof window.matchMedia !== 'function') {
			return function utilHasMediaQuery() {
				return false;
			};
		}

		// Elsewise, return the regular `utilHasMediaQuery()` function.
		return function utilHasMediaQuery(mediaQuery) {
			return window.matchMedia(mediaQuery).matches;
		};
	})();


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Type Functions.
		*/
		getType       : { value : utilGetType },
		isBoolean     : { value : utilIsBoolean },
		isIterable    : { value : utilIsIterable },
		isNumeric     : { value : utilIsNumeric },
		sameValueZero : { value : utilSameValueZero },
		toEnum        : { value : utilToEnum },
		toStringTag   : { value : utilToStringTag },

		/*
			String Encoding Functions.
		*/
		slugify          : { value : utilSlugify },
		sanitizeFilename : { value : utilSanitizeFilename },
		escapeMarkup     : { value : utilEscapeMarkup },
		escape           : { value : utilEscape },
		unescape         : { value : utilUnescape },
		charAndPosAt     : { value : utilCharAndPosAt },

		/*
			Time Functions.
		*/
		now : { value : utilNow },

		/*
			Conversion Functions.
		*/
		fromCssTime      : { value : utilFromCssTime },
		toCssTime        : { value : utilToCssTime },
		fromCssProperty  : { value : utilFromCssProperty },
		parseUrl         : { value : utilParseUrl },
		newExceptionFrom : { value : utilNewExceptionFrom },
		scrubEventKey    : { value : utilScrubEventKey },

		/*
			Browser API Functions.
		*/
		hasMediaQuery : { value : utilHasMediaQuery },

		/*
			Legacy Aliases.
		*/
		random         : { value : Math.random },
		entityEncode   : { value : utilEscape },
		entityDecode   : { value : utilUnescape },
		evalExpression : { value : (...args) => Scripting.evalJavaScript(...args) }, // SEE: `markup/scripting.js`.
		evalStatements : { value : (...args) => Scripting.evalJavaScript(...args) }  // SEE: `markup/scripting.js`.
	}));
})();

/***********************************************************************************************************************

	lib/simplestore/simplestore.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

var SimpleStore = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// In-order list of database adapters.
	const _adapters = [];

	// The initialized adapter.
	let _initialized = null;


	/*******************************************************************************************************************
		SimpleStore Functions.
	*******************************************************************************************************************/
	function storeCreate(storageId, persistent) {
		if (_initialized) {
			return _initialized.create(storageId, persistent);
		}

		// Return the first adapter which successfully initializes, elsewise throw an exception.
		for (let i = 0; i < _adapters.length; ++i) {
			if (_adapters[i].init(storageId, persistent)) {
				_initialized = _adapters[i];
				return _initialized.create(storageId, persistent);
			}
		}

		throw new Error('no valid storage adapters found');
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Adapters List.

			TODO: This should probably have a getter, rather than being exported directly.
		*/
		adapters : { value : _adapters },

		/*
			Core Functions.
		*/
		create : { value : storeCreate }
	}));
})();

/***********************************************************************************************************************

	lib/simplestore/adapters/FCHost.Storage.js

	Copyright Â© 2013â€“2019 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global SimpleStore, Util */

SimpleStore.adapters.push((() => {
	'use strict';

	// Adapter readiness state.
	let _ok = false;


	/*******************************************************************************************************************
		_FCHostStorageAdapter Class.
        Note that FCHost is only intended for a single document, so we ignore both prefixing and storageID
	*******************************************************************************************************************/
	class _FCHostStorageAdapter {
		constructor(persistent) {
			let engine = null;
			let name   = null;

			if (persistent) {
				engine = window.FCHostPersistent;
				name   = 'FCHostPersistent';
			}
			else {
			    engine = window.FCHostSession;
				name   = 'FCHostSession';
			}

			Object.defineProperties(this, {
				_engine : {
					value : engine
				},
                
				name : {
					value : name
				},

				persistent : {
					value : !!persistent
				}
			});
		}

		/* legacy */
		get length() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.length : Number]`); }

			return this._engine.size();
		}
		/* /legacy */

		size() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.size() : Number]`); }

			return this._engine.size();
		}

		keys() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.keys() : String Array]`); }

			return this._engine.keys();
		}

		has(key) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.has(key: "${key}") : Boolean]`); }

			if (typeof key !== 'string' || !key) {
				return false;
			}

			return this._engine.has(key);
		}

		get(key) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.get(key: "${key}") : Any]`); }

			if (typeof key !== 'string' || !key) {
				return null;
			}

			const value = this._engine.get(key);

			return value == null ? null : _FCHostStorageAdapter._deserialize(value); // lazy equality for null
		}

		set(key, value) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.set(key: "${key}", value: \u2026) : Boolean]`); }

			if (typeof key !== 'string' || !key) {
				return false;
			}

			this._engine.set(key, _FCHostStorageAdapter._serialize(value));

			return true;
		}

		delete(key) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.delete(key: "${key}") : Boolean]`); }

			if (typeof key !== 'string' || !key) {
				return false;
			}

			this._engine.remove(key);

			return true;
		}

		clear() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.clear() : Boolean]`); }

			this._engine.clear();

			return true;
		}

		static _serialize(obj) {
			return JSON.stringify(obj);
		}

		static _deserialize(str) {
			return JSON.parse(str);
		}
	}


	/*******************************************************************************************************************
		Adapter Utility Functions.
	*******************************************************************************************************************/
	function adapterInit() {
		// FCHost feature test.
		function hasFCHostStorage() {
			try {
			    if (typeof window.FCHostPersistent !== 'undefined')
			        return true;
			}
			catch (ex) { /* no-op */ }

			return false;
		}

		_ok = hasFCHostStorage();
		
		return _ok;
	}

	function adapterCreate(storageId, persistent) {
		if (!_ok) {
			throw new Error('adapter not initialized');
		}

		return new _FCHostStorageAdapter(persistent);
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		init   : { value : adapterInit },
		create : { value : adapterCreate }
	}));
})());

/***********************************************************************************************************************

	lib/simplestore/adapters/webstorage.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global SimpleStore, Util, Config */

SimpleStore.adapters.push((() => {
	'use strict';

	// Adapter readiness state.
	let _ok = false;


	/*******************************************************************************************************************
		_WebStorageAdapter Class.
	*******************************************************************************************************************/
	class _WebStorageAdapter {
		constructor(storageId, persistent) {
			const prefix = `${storageId}.`;
			let engine = null;
			let name   = null;

			if (persistent) {
				engine = window.localStorage;
				name   = 'localStorage';
			}
			else {
				engine = window.sessionStorage;
				name   = 'sessionStorage';
			}

			Object.defineProperties(this, {
				_engine : {
					value : engine
				},

				_prefix : {
					value : prefix
				},

				_prefixRe : {
					value : new RegExp(`^${RegExp.escape(prefix)}`)
				},

				name : {
					value : name
				},

				id : {
					value : storageId
				},

				persistent : {
					value : !!persistent
				}
			});
		}

		/* legacy */
		get length() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.length : Number]`); }

			/*
				NOTE: DO NOT do something like `return this._engine.length;` here,
				as that will return the length of the entire store, rather than
				just our prefixed keys.
			*/
			return this.keys().length;
		}
		/* /legacy */

		size() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.size() : Number]`); }

			/*
				NOTE: DO NOT do something like `return this._engine.length;` here,
				as that will return the length of the entire store, rather than
				just our prefixed keys.
			*/
			return this.keys().length;
		}

		keys() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.keys() : String Array]`); }

			const keys = [];

			for (let i = 0; i < this._engine.length; ++i) {
				const key = this._engine.key(i);

				if (this._prefixRe.test(key)) {
					keys.push(key.replace(this._prefixRe, ''));
				}
			}

			return keys;
		}

		has(key) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.has(key: "${key}") : Boolean]`); }

			if (typeof key !== 'string' || !key) {
				return false;
			}

			// // FIXME: This method should probably check for the key, rather than comparing its value.
			// return this._engine.getItem(this._prefix + key) != null; // lazy equality for null

			return this._engine.hasOwnProperty(this._prefix + key);
		}

		get(key) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.get(key: "${key}") : Any]`); }

			if (typeof key !== 'string' || !key) {
				return null;
			}

			const value = this._engine.getItem(this._prefix + key);

			return value == null ? null : _WebStorageAdapter._deserialize(value); // lazy equality for null
		}

		set(key, value) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.set(key: "${key}", value: \u2026) : Boolean]`); }

			if (typeof key !== 'string' || !key) {
				return false;
			}

			try {
				this._engine.setItem(this._prefix + key, _WebStorageAdapter._serialize(value));
			}
			catch (ex) {
				/*
					If the exception is a quota exceeded error, massage it into something
					a bit nicer for the player.

					NOTE: Ideally, we could simply do something like checking `ex.code`, but
					it's a non-standard property and not supported in all browsers.  Thus,
					we have to resort to pattern matching the name and message—the latter being
					required by Opera (Presto).  I hate the parties responsible for this snafu
					so much.
				*/
				if (/quota.?(?:exceeded|reached)/i.test(ex.name + ex.message)) {
					throw Util.newExceptionFrom(ex, Error, `${this.name} quota exceeded`);
				}

				throw ex;
			}

			return true;
		}

		delete(key) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.delete(key: "${key}") : Boolean]`); }

			if (typeof key !== 'string' || !key) {
				return false;
			}

			this._engine.removeItem(this._prefix + key);

			return true;
		}

		clear() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.clear() : Boolean]`); }

			const keys = this.keys();

			for (let i = 0, iend = keys.length; i < iend; ++i) {
				if (DEBUG) { console.log('\tdeleting key:', keys[i]); }

				this.delete(keys[i]);
			}

			// return this.keys().forEach(key => {
			// 	if (DEBUG) { console.log('\tdeleting key:', key); }
			//
			// 	this.delete(key);
			// });

			return true;
		}

		static _serialize(obj) {
			if (Config.saves.useLZString === 1) return LZString.compressToUTF16(JSON.stringify(obj));
			return JSON.stringify(obj);
		}

		static _deserialize(str) {
			let parsedObj = null;
			// parse as JSON string by default, switch to LZString
			try {
				parsedObj = JSON.parse(str);
				if (Config.saves.useLZString === -1) Config.saves.useLZString = 0;
			}
			catch (ex) {
				parsedObj = JSON.parse(LZString.decompressFromUTF16(str));
				if (Config.saves.useLZString === -1) Config.saves.useLZString = 1;
			}
			return parsedObj;
		}
	}


	/*******************************************************************************************************************
		Adapter Utility Functions.
	*******************************************************************************************************************/
	function adapterInit() {
		// Web Storage feature test.
		function hasWebStorage(storeId) {
			try {
				const store = window[storeId];
				const tid   = `_sc_${String(Date.now())}`;
				store.setItem(tid, tid);
				const result = store.getItem(tid) === tid;
				store.removeItem(tid);
				return result;
			}
			catch (ex) { /* no-op */ }

			return false;
		}

		/*
			Just to be safe, we feature test for both `localStorage` and `sessionStorage`,
			as you never know what browser implementation bugs you're going to run into.
		*/
		_ok = hasWebStorage('localStorage') && hasWebStorage('sessionStorage');

		return _ok;
	}

	function adapterCreate(storageId, persistent) {
		if (!_ok) {
			throw new Error('adapter not initialized');
		}

		return new _WebStorageAdapter(storageId, persistent);
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		init   : { value : adapterInit },
		create : { value : adapterCreate }
	}));
})());

/***********************************************************************************************************************

	lib/simplestore/adapters/cookie.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global SimpleStore, Util */

SimpleStore.adapters.push((() => {
	'use strict';

	// Expiry constants.
	const _MAX_EXPIRY = 'Tue, 19 Jan 2038 03:14:07 GMT'; // (new Date((Math.pow(2, 31) - 1) * 1000)).toUTCString()
	const _MIN_EXPIRY = 'Thu, 01 Jan 1970 00:00:00 GMT'; // (new Date(0)).toUTCString()

	// Adapter readiness state.
	let _ok = false;


	/*******************************************************************************************************************
		_CookieAdapter Class.
	*******************************************************************************************************************/
	class _CookieAdapter {
		constructor(storageId, persistent) {
			const prefix = `${storageId}${persistent ? '!' : '*'}.`;

			Object.defineProperties(this, {
				_prefix : {
					value : prefix
				},

				_prefixRe : {
					value : new RegExp(`^${RegExp.escape(prefix)}`)
				},

				name : {
					value : 'cookie'
				},

				id : {
					value : storageId
				},

				persistent : {
					value : !!persistent
				}
			});
		}

		/* legacy */
		get length() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.length : Number]`); }

			return this.keys().length;
		}
		/* /legacy */

		size() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.size() : Number]`); }

			return this.keys().length;
		}

		keys() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.keys() : String Array]`); }

			if (document.cookie === '') {
				return [];
			}

			const cookies = document.cookie.split(/;\s*/);
			const keys    = [];

			for (let i = 0; i < cookies.length; ++i) {
				const kvPair = cookies[i].split('=');
				const key    = decodeURIComponent(kvPair[0]);

				if (this._prefixRe.test(key)) {
					/*
						All stored values are serialized and an empty string serializes to a non-empty
						string.  Therefore, receiving an empty string here signifies a deleted value,
						not a serialized empty string, so we should omit such pairs.
					*/
					const value = decodeURIComponent(kvPair[1]);

					if (value !== '') {
						keys.push(key.replace(this._prefixRe, ''));
					}
				}
			}

			return keys;
		}

		has(key) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.has(key: "${key}") : Boolean]`); }

			if (typeof key !== 'string' || !key) {
				return false;
			}

			return _CookieAdapter._getCookie(this._prefix + key) !== null;
		}

		get(key) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.get(key: "${key}") : Any]`); }

			if (typeof key !== 'string' || !key) {
				return null;
			}

			const value = _CookieAdapter._getCookie(this._prefix + key);

			return value === null ? null : _CookieAdapter._deserialize(value);
		}

		set(key, value) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.set(key: "${key}", value: \u2026) : Boolean]`); }

			if (typeof key !== 'string' || !key) {
				return false;
			}

			try {
				_CookieAdapter._setCookie(
					this._prefix + key,
					_CookieAdapter._serialize(value),

					// An undefined expiry denotes a session cookie.
					this.persistent ? _MAX_EXPIRY : undefined
				);

				if (!this.has(key)) {
					throw new Error('unknown validation error during set');
				}
			}
			catch (ex) {
				// Massage the cookie exception into something a bit nicer for the player.
				throw Util.newExceptionFrom(ex, Error, `cookie error: ${ex.message}`);
			}

			return true;
		}

		delete(key) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.delete(key: "${key}") : Boolean]`); }

			/*
				Attempting to delete a cookie implies setting it, so we test for its existence
				beforehand, to avoid creating it in the event that it does not already exist.
			*/
			if (typeof key !== 'string' || !key || !this.has(key)) {
				return false;
			}

			try {
				_CookieAdapter._setCookie(
					this._prefix + key,

					// Use `undefined` as the value.
					undefined,

					// Use the epoch as the expiry.
					_MIN_EXPIRY
				);

				if (this.has(key)) {
					throw new Error('unknown validation error during delete');
				}
			}
			catch (ex) {
				// Massage the cookie exception into something a bit nicer for the player.
				throw Util.newExceptionFrom(ex, Error, `cookie error: ${ex.message}`);
			}

			return true;
		}

		clear() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.clear() : Boolean]`); }

			const keys = this.keys();

			for (let i = 0, iend = keys.length; i < iend; ++i) {
				if (DEBUG) { console.log('\tdeleting key:', keys[i]); }

				this.delete(keys[i]);
			}

			// this.keys().forEach(key => {
			// 	if (DEBUG) { console.log('\tdeleting key:', key); }
			//
			// 	this.delete(key);
			// });

			return true;
		}

		static _getCookie(prefixedKey) {
			if (!prefixedKey || document.cookie === '') {
				return null;
			}

			const cookies = document.cookie.split(/;\s*/);

			for (let i = 0; i < cookies.length; ++i) {
				const kvPair = cookies[i].split('=');
				const key    = decodeURIComponent(kvPair[0]);

				if (prefixedKey === key) {
					const value = decodeURIComponent(kvPair[1]);

					/*
						All stored values are serialized and an empty string serializes to a non-empty
						string.  Therefore, receiving an empty string here signifies a deleted value,
						not a serialized empty string, so we should yield `null` for such pairs.
					*/
					return value || null;
				}
			}

			return null;
		}

		static _setCookie(prefixedKey, value, expiry) {
			if (!prefixedKey) {
				return;
			}

			let payload = `${encodeURIComponent(prefixedKey)}=`;

			if (value != null) { // lazy equality for null
				payload += encodeURIComponent(value);
			}

			if (expiry != null) { // lazy equality for null
				payload += `; expires=${expiry}`;
			}

			payload += '; path=/';
			document.cookie = payload;
		}

		static _serialize(obj) {
			// return LZString.compressToBase64(JSON.stringify(obj)); // TODO keep LZString a config option?
			return JSON.stringify(obj);
		}

		static _deserialize(str) {
			// return JSON.parse(LZString.decompressFromBase64(str));
			return JSON.parse(str);
		}
	}


	/*******************************************************************************************************************
		Adapter Utility Functions.
	*******************************************************************************************************************/
	function adapterInit(
		// Only used for stores updates.
		storageId
	) {
		// Cookie feature test.
		try {
			const tid = `_sc_${String(Date.now())}`;

			// We only test a session cookie as that should suffice.
			_CookieAdapter._setCookie(tid, _CookieAdapter._serialize(tid), undefined);
			_ok = _CookieAdapter._deserialize(_CookieAdapter._getCookie(tid)) === tid;
			_CookieAdapter._setCookie(tid, undefined, _MIN_EXPIRY);
		}
		catch (ex) {
			_ok = false;
		}

		/* legacy */
		// Attempt to update the cookie stores, if necessary.  This should happen only during initialization.
		if (_ok) {
			_updateCookieStores(storageId);
		}
		/* /legacy */

		return _ok;
	}

	function adapterCreate(storageId, persistent) {
		if (!_ok) {
			throw new Error('adapter not initialized');
		}

		return new _CookieAdapter(storageId, persistent);
	}

	/* legacy */
	// Updates old non-segmented cookie stores into segmented stores.
	function _updateCookieStores(storageId) {
		if (document.cookie === '') {
			return;
		}

		const oldPrefix     = `${storageId}.`;
		const oldPrefixRe   = new RegExp(`^${RegExp.escape(oldPrefix)}`);
		const persistPrefix = `${storageId}!.`;
		const sessionPrefix = `${storageId}*.`;
		const sessionTestRe = /\.(?:state|rcWarn)$/;
		const cookies       = document.cookie.split(/;\s*/);

		for (let i = 0; i < cookies.length; ++i) {
			const kvPair = cookies[i].split('=');
			const key    = decodeURIComponent(kvPair[0]);

			if (oldPrefixRe.test(key)) {
				/*
					All stored values are serialized and an empty string serializes to a non-empty
					string.  Therefore, receiving an empty string here signifies a deleted value,
					not a serialized empty string, so we should skip processing such pairs.
				*/
				const value = decodeURIComponent(kvPair[1]);

				if (value !== '') {
					const persist = !sessionTestRe.test(key);

					// Delete the old k/v pair.
					_CookieAdapter._setCookie(
						key,
						undefined,
						_MIN_EXPIRY
					);

					// Set the new k/v pair.
					_CookieAdapter._setCookie(
						key.replace(oldPrefixRe, () => persist ? persistPrefix : sessionPrefix),
						value,
						persist ? _MAX_EXPIRY : undefined
					);
				}
			}
		}
	}
	/* /legacy */


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		init   : { value : adapterInit },
		create : { value : adapterCreate }
	}));
})());

/***********************************************************************************************************************

	lib/debugview.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

/*
	TODO: Make this use jQuery throughout.
*/
var DebugView = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
		DebugView Class.
	*******************************************************************************************************************/
	class DebugView {
		constructor(parent, type, name, title) {
			Object.defineProperties(this, {
				parent : {
					value : parent
				},

				view : {
					value : document.createElement('span')
				},

				break : {
					value : document.createElement('wbr')
				}
			});

			// Set up the wrapper (`<span>`) element.
			jQuery(this.view)
				.attr({
					title,
					'aria-label' : title,
					'data-type'  : type != null ? type : '', // lazy equality for null
					'data-name'  : name != null ? name : ''  // lazy equality for null
				})
				.addClass('debug');

			// Set up the word break (`<wbr>`) element.
			jQuery(this.break).addClass('debug hidden');

			// Add the wrapper (`<span>`) and word break (`<wbr>`) elements to the `parent` element.
			this.parent.appendChild(this.view);
			this.parent.appendChild(this.break);
		}

		get output() {
			return this.view;
		}

		get type() {
			return this.view.getAttribute('data-type');
		}
		set type(type) {
			this.view.setAttribute('data-type', type != null ? type : ''); // lazy equality for null
		}

		get name() {
			return this.view.getAttribute('data-name');
		}
		set name(name) {
			this.view.setAttribute('data-name', name != null ? name : ''); // lazy equality for null
		}

		get title() {
			return this.view.title;
		}
		set title(title) {
			this.view.title = title;
		}

		append(el) {
			jQuery(this.view).append(el);
			return this;
		}

		modes(options) {
			if (options == null) { // lazy equality for null
				const current = {};

				this.view.className.splitOrEmpty(/\s+/).forEach(name => {
					if (name !== 'debug') {
						current[name] = true;
					}
				});

				return current;
			}
			else if (typeof options === 'object') {
				Object.keys(options).forEach(function (name) {
					this[options[name] ? 'addClass' : 'removeClass'](name);
				}, jQuery(this.view));

				return this;
			}

			throw new Error('DebugView.prototype.modes options parameter must be an object or null/undefined');
		}

		remove() {
			const $view = jQuery(this.view);

			if (this.view.hasChildNodes()) {
				$view.contents().appendTo(this.parent);
			}

			$view.remove();
			jQuery(this.break).remove();
		}

		static isEnabled() {
			return jQuery(document.documentElement).attr('data-debug-view') === 'enabled';
		}

		static enable() {
			jQuery(document.documentElement).attr('data-debug-view', 'enabled');
			jQuery.event.trigger(':debugviewupdate');
		}

		static disable() {
			jQuery(document.documentElement).removeAttr('data-debug-view');
			jQuery.event.trigger(':debugviewupdate');
		}

		static toggle() {
			if (jQuery(document.documentElement).attr('data-debug-view') === 'enabled') {
				DebugView.disable();
			}
			else {
				DebugView.enable();
			}
		}
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return DebugView;
})();

/***********************************************************************************************************************

	lib/nodetyper.js

	Copyright © 2020–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Util */

var NodeTyper = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
		NodeTyper Class.
	*******************************************************************************************************************/
	class NodeTyper {
		constructor(config) {
			if (typeof config !== 'object' || config === null) {
				throw new Error(`config parameter must be an object (received: ${Util.getType(config)})`);
			}
			if (!config.hasOwnProperty('targetNode') || !(config.targetNode instanceof Node)) {
				throw new Error('config parameter object "targetNode" property must be a node');
			}

			Object.defineProperties(this, {
				node : {
					value : config.targetNode
				},

				childNodes : {
					value : []
				},

				nodeValue : {
					writable : true,
					value    : ''
				},

				appendTo : {
					writable : true,
					value    : config.parentNode || null
				},

				classNames : {
					writable : true,
					value    : config.classNames || null
				},

				finished : {
					writable : true,
					value    : false
				}
			});

			const node = this.node;

			if (node.nodeValue) {
				this.nodeValue = node.nodeValue;
				node.nodeValue = '';
			}

			let childNode;

			while ((childNode = node.firstChild) !== null) {
				this.childNodes.push(new NodeTyper({
					targetNode : childNode,
					parentNode : node,
					classNames : this.classNames
				}));

				node.removeChild(childNode);
			}
		}

		finish() {
			while (this.type(true)) /* no-op */;
			return false;
		}

		type(flush) {
			if (this.finished) {
				return false;
			}

			if (this.appendTo) {
				this.appendTo.appendChild(this.node);
				this.appendTo = null;

				// Immediately finish typing this node if….
				if (
					// …it's neither a element or text node.
					this.node.nodeType !== Node.ELEMENT_NODE && this.node.nodeType !== Node.TEXT_NODE

					// …or the computed value of its parent node's `display` property is `'none'`.
					|| jQuery(this.node.parentNode).css('display') === 'none'
				) {
					return this.finish();
				}

				if (this.node.parentNode && this.classNames) {
					jQuery(this.node.parentNode).addClass(this.classNames);
				}
			}

			if (this.nodeValue) {
				if (flush) {
					// Concatenate here in case we've already done some processing.
					this.node.nodeValue += this.nodeValue;
					this.nodeValue = '';
				}
				else {
					// Use `Util.charAndPosAt()` here to properly handle Unicode code points
					// that are comprised of surrogate pairs.
					const { char, start, end } = Util.charAndPosAt(this.nodeValue, 0);
					this.node.nodeValue += char;
					this.nodeValue = this.nodeValue.slice(1 + end - start);
				}

				return true;
			}

			if (this.classNames) {
				jQuery(this.node.parentNode).removeClass(this.classNames);
				this.classNames = null;
			}

			const childNodes = this.childNodes;

			while (childNodes.length > 0) {
				if (childNodes[0].type()) {
					return true;
				}

				childNodes.shift();
			}

			this.finished = true;
			return false;
		}
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return NodeTyper;
})();

/* dumb predictable rng algorithm that i came up with as i was falling asleep yesterday */
/* copyleft anomajou, 2024 */
/* also, you owe author a beer now */

class PRNG {
	constructor(seed, pull) {
		// primes are a prime source of entropy in our generator. pun intended. intend your puns, people!
		this.primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
		// limiter makes sure that after multiplying all parts of a randomizer at their maximum theoretical values, we
		// are still below Number.MAX_SAFE_INTEGER, for better granularity.
		// incidentally, it ends up being 17623651, a prime number, which is perfect for our use
		this.limiter = Math.floor(Math.sqrt(Number.MAX_SAFE_INTEGER / this.primes[this.primes.length - 1]));
		// factor needs to consistently overflow the limiter in an inconsistent way when multiplied by integers in
		// increments of 1, so ideally it has to be another prime in the interval (limiter/2 .. limiter).
		// unlike the limiter, it is much harder to determine programmatically...
		// note: if Number.MAX_SAFE_INTEGER is NOT 9007199254740991 on your system - you need to adjust this factor!
		this.factor = 12345653;
		// pull is the number of times random() was called, and the main input of our generator.
		// it doesn't actually have to be an integer, just incrementable
		this.pull = Number(pull) || 0;

		// seed is the second input for the generator. it has to be below ~1 to stay within MAX_SAFE_INTEGER (although
		// it doesn't hurt much if it's not), and it shouldn't be below ~0.25, or the factor will have trouble
		// overflowing as often as it should. still, other values should be possible, for science
		switch (typeof seed) {
			case 'number': {
				if (seed < 0.25 || seed > 1) console.warn(`recommended seed value is between 0.25 and 1, got ${seed}`);
				this.seed = seed;
				break;
			}
			case 'string': {
				// map character codes onto an interval between 0.25 and 1
				// then at some point it came to me that original string is worth preserving, so let's do that
				this.seed = seed;
				this.seedInt = this.str2int(seed);
				break;
			}
			default: {
				this.seed = (Math.random() * 3 + 1) / 4;
			}
		}
	}

	/**
	 * stupid randomizer function
	 * @param {number} [peek=0] if set, predicts the number that is n steps ahead instead of advancing to the next one
	 * @returns {number (0, 1)} random number between 0 and 1, non-inclusive
	 */
	random(peek = 0) {
		if (!peek) ++this.pull;
		const limiter = this.limiter;
		// prefer seedInt before seed, allowing seed to stay a string
		const seed = this.seedInt || this.seed;
		// make sure seed matters more by affecting effective pull so the chaos can catch up
		// chaos in this case being the ability of tiny variation in seed to result in huge difference in the outcome
		// remember, the real this.pull is meant to represent the real number of times random() was called
		const pull = Math.floor((this.pull + peek + seed * 4327) % limiter) + 1;
		// get some extra entropy by alternating primes
		const extra = this.primes[pull % (this.primes.length - 1)];

		return pull * seed * extra * this.factor % (limiter - 1) / limiter;
	}

	/*
		Returns a pseudo-random whole number (integer) within the range of the given bounds.
	*/
	randomInt(/* [min], max, peek */) {
		let min = 0;
		let max;
		let peek = 0;

		switch (arguments.length) {
			case 0: throw new Error('randomInt called with insufficient parameters');
			case 1: max = Math.trunc(arguments[0]); break;
			default: min = Math.trunc(arguments[0]); max = Math.trunc(arguments[1]); peek = arguments[2] || 0; break;
		}
		if (!Number.isInteger(min) || !Number.isInteger(max) || !Number.isInteger(peek)) throw new Error(`randomInt called with invalid parameters, ${JSON.stringify(arguments)}`);

		return Math.floor(this.random(peek) * (max - min + 1)) + min;
	}

	/*
		Returns a pseudo-random real number (floating-point) within the range of the given bounds.

		NOTE: Unlike with its sibling function `random()`, the `max` parameter
		is exclusive, not inclusive—i.e. the range goes to, but does not include,
		the given value.
		actually, i'm not sure it's possible to ever roll min either.
	*/
	randomFloat(/* [min], max, peek */) {
		let min;
		let max;
		let peek = 0;

		switch (arguments.length) {
			case 0: throw new Error('randomFloat called with insufficient parameters');
			case 1: min = 0.0; max = Number(arguments[0]); break;
			default: min = Number(arguments[0]); max = Number(arguments[1]); peek = arguments[2] || 0; break;
		}
		if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isInteger(peek)) throw new Error(`randomFloat called with invalid parameters, ${JSON.stringify(arguments)}`);

		return this.random() * (max - min) + min;
	}

	/*
		Randomly shuffles an array and returns it.
	*/
	shuffle(array, mutate = true) {
		if (!Array.isArray(array)) throw new Error(`shuffle expected an array, got ${typeof array}`);
		if (array.length === 0) return;

		const arr = mutate ? array : clone(array);
		for (let i = arr.length - 1; i > 0; --i) {
			const j = this.randomInt(0, i);

			if (i === j) 	continue;

			// [arr[i], arr[j]] = [arr[j], arr[i]];
			const swap = arr[i];
			arr[i] = arr[j];
			arr[j] = swap;
		}

		return arr;
	}

	toShuffled(array) {
		return this.shuffle(array, false);
	}

	/*
		Returns a random value from its given arguments.
	*/
	either() {
		const arr = Array.prototype.concat.apply([], arguments);
		if (arr.length === 0) return;

		return arr[this.randomInt(arr.length - 1)];
	}

	/**
	 * function to peek into the list of n future random values without altering the pull value
	 * @param {number} depth how many numbers to return
	 * @returns {Array} list of predicted random numbers ahead
	 */
	peek(depth = 1) {
		if (!Number.isInteger(depth)) return console.error(`can't look ahead ${depth} times`);
		if (depth > 9000) return console.error('it\'s over 9000!');
		const result = [];
		for (let i = 1; i <= depth; ++i) result.push(this.random(i));
		return result;
	}

	/**
	 * string to seed converter
	 * @param {string} string to convert
	 * @returns {number [0.25, 1]} float between 0.25 and 1, inclusive
	 */
	str2int(string) {
		let sum = 0;
		let count = 0;
		for (const char of string) {
			const code = char.charCodeAt();
			// i don't want your emojis and non-ascii characters
			if (code < 32 || code > 127) continue;
			sum += code - 32;
			++count;
		}
		// some strings might lack valid characters to count, especially empty strings
		return count ? sum / count / 127 + 0.25 : 0.25;
	}

	/**
	 * test function to check the random distribution
	 * @param {number} count how many times to roll
	 * @param {number} granularity how many baskets to fill
	 * @param {boolean} advancerng increase the actual prng pull value
	 * @returns {Array} how many times each basket was hit
	 */
	test(count = 10, granularity = 10, advancerng) {
		const distribution = new Array(granularity).fill(0);
		for (let i = 1; i <= count; ++i) ++distribution[Math.floor(this.random(i) * granularity)];
		if (advancerng) this.pull += count;
		return distribution;
	}
}
window.PRNG = PRNG;

/***********************************************************************************************************************

	lib/stylewrapper.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Patterns, Story, Wikifier */

var StyleWrapper = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	const _imageMarkupRe    = new RegExp(Patterns.cssImage, 'g');
	const _hasImageMarkupRe = new RegExp(Patterns.cssImage);


	/*******************************************************************************************************************
		StyleWrapper Class.
	*******************************************************************************************************************/
	class StyleWrapper {
		constructor(style) {
			if (style == null) { // lazy equality for null
				throw new TypeError('StyleWrapper style parameter must be an HTMLStyleElement object');
			}

			Object.defineProperties(this, {
				style : {
					value : style
				}
			});
		}

		isEmpty() {
			// This should work in all supported browsers.
			return this.style.cssRules.length === 0;
		}

		set(rawCss) {
			this.clear();
			this.add(rawCss);
		}

		add(rawCss) {
			let css = rawCss;

			// Check for wiki image transclusion.
			if (_hasImageMarkupRe.test(css)) {
				/*
					The JavaScript specifications, since at least ES3, say that `<String>.replace()`
					should reset a global-flagged regular expression's `lastIndex` property to `0`
					upon invocation.  Buggy browser versions exist, however, which do not reset
					`lastIndex`, so we should do so manually to support those browsers.

					NOTE: I do not think this is actually necessary, since `_imageMarkupRe` is
					scoped to this module—meaning users should not be able to access it.  That
					being the case, and since we search to exhaustion which should also cause
					`lastIndex` to be reset, there should never be an instance where we invoke
					`css.replace()` and `_imageMarkupRe.lastIndex` is not already `0`.  Still,
					considering the other bug, better safe than sorry.
				*/
				_imageMarkupRe.lastIndex = 0;

				css = css.replace(_imageMarkupRe, wikiImage => {
					const markup = Wikifier.helpers.parseSquareBracketedMarkup({
						source     : wikiImage,
						matchStart : 0
					});

					if (markup.hasOwnProperty('error') || markup.pos < wikiImage.length) {
						return wikiImage;
					}

					let source = markup.source;

					// Handle image passage transclusion.
					if (source.slice(0, 5) !== 'data:' && Story.has(source)) {
						const passage = Story.get(source);

						if (passage.tags.includes('Twine.image')) {
							source = passage.text.trim();
						}
					}

					/*
						The source may be URI- or Base64-encoded, so we cannot use `encodeURIComponent()`
						here.  Instead, we simply encode any double quotes, since the URI will be
						delimited by them.
					*/
					return `url("${source.replace(/"/g, '%22')}")`;
				});
			}

			// For IE ≤ 10.
			if (this.style.styleSheet) {
				this.style.styleSheet.cssText += css;
			}

			// For all other browsers (incl. IE ≥ 11).
			else {
				this.style.appendChild(document.createTextNode(css));
			}
		}

		clear() {
			// For IE ≤10.
			if (this.style.styleSheet) {
				this.style.styleSheet.cssText = '';
			}

			// For all other browsers (incl. IE ≥11).
			else {
				jQuery(this.style).empty();
			}
		}
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return StyleWrapper;
})();

/***********************************************************************************************************************

	util/enumfrom.js

	Copyright © 2013–2023 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

/*
	Returns a pseudo-enumeration object created from the given Array, Map, Set,
	or generic object.
*/
function enumFrom(O) { // eslint-disable-line no-unused-vars
	const pEnum = Object.create(null);

	if (O instanceof Array) {
		O.forEach((val, i) => pEnum[String(val)] = i);
	}
	else if (O instanceof Set) {
		// NOTE: Use `<Array>.forEach()` here rather than `<Set>.forEach()`
		// as the latter does not provide the indices we require.
		Array.from(O).forEach((val, i) => pEnum[String(val)] = i);
	}
	else if (O instanceof Map) {
		O.forEach((val, key) => pEnum[String(key)] = val);
	}
	else if (
		O !== null
		&& typeof O === 'object'
		&& Object.getPrototypeOf(O) === Object.prototype
	) {
		Object.assign(pEnum, O);
	}
	else {
		throw new TypeError('enumFrom object parameter must be an Array, Map, Set, or generic object');
	}

	return Object.freeze(Object.defineProperties(pEnum, {
		nameFrom : {
			value(needle) {
				const entry = Object.entries(this).find(entry => entry[1] === needle);
				return entry ? entry[0] : undefined;
			}
		}
	}));
}

/***********************************************************************************************************************

	lib/diff.js

	Copyright © 2013–2023 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global clone, enumFrom */

var Diff = (() => { // eslint-disable-line no-unused-vars, no-var
	// Diff operations object.
	const Op = enumFrom({
		Delete      : 0,
		SpliceArray : 1,
		Copy        : 2,

		/* legacy */
		CopyDate : 3
		/* /legacy */
	});


	/*******************************************************************************
		Diff Functions.
	*******************************************************************************/

	// Returns whether the given value is a finite number or a numeric string
	// that yields a finite number when parsed.
	function isNumeric(O) {
		let num;

		switch (typeof O) {
			case 'number': num = O; break;
			case 'string': num = Number(O); break;
			default:       return false;
		}

		return !Number.isNaN(num) && Number.isFinite(num);
	}

	// Returns a delta object generated from comparing the `a` and `b` objects.
	function diff(a, b) /* delta object */ {
		const toString = Object.prototype.toString;
		const aIsArray = a instanceof Array;
		const delta    = Object.create(null);
		const keys     = [...Object.keys(a), ...Object.keys(b)]
			.sort()
			.filter((val, i, arr) => i === 0 || arr[i - 1] !== val);
		let aOpKey;

		// Array operation predicate.
		const isAOpKey = key => key === aOpKey;

		/* eslint-disable max-depth */
		for (let i = 0, klen = keys.length; i < klen; ++i) {
			const key  = keys[i];
			const aVal = a[key];
			const bVal = b[key];

			// Key exists in `a`.
			if (Object.hasOwn(a, key)) {
				// Key exists in both.
				if (Object.hasOwn(b, key)) {
					// Values are exactly the same, so do nothing.
					if (aVal === bVal) {
						continue;
					}

					// Values are of the same basic type.
					if (typeof aVal === typeof bVal) {
						// Values are functions.
						if (typeof aVal === 'function') {
							/* delta[key] = [Op.Copy, bVal]; */
							if (aVal.toString() !== bVal.toString()) {
								delta[key] = [Op.Copy, bVal];
							}
						}

						// Values are primitives.
						else if (typeof aVal !== 'object' || aVal === null) {
							delta[key] = [Op.Copy, bVal];
						}

						// Values are objects.
						else {
							const aValType = toString.call(aVal);
							const bValType = toString.call(bVal);

							// Values are objects of the same reported type.
							if (aValType === bValType) {
								// Supported natives and generic objects.
								if (aVal instanceof Date) {
									if (aVal.getTime() !== bVal.getTime()) {
										delta[key] = [Op.Copy, clone(bVal)];
									}
								}
								else if (aVal instanceof Map) {
									delta[key] = [Op.Copy, clone(bVal)];
								}
								else if (aVal instanceof RegExp) {
									if (aVal.toString() !== bVal.toString()) {
										delta[key] = [Op.Copy, clone(bVal)];
									}
								}
								else if (aVal instanceof Set) {
									delta[key] = [Op.Copy, clone(bVal)];
								}
								else if (aVal instanceof Array || aValType === '[object Object]') {
									const subDelta = diff(aVal, bVal);

									if (subDelta !== null) {
										delta[key] = subDelta;
									}
								}

								// Unknown non-generic objects (custom or unsupported natives).
								else {
									// We cannot know how to process these objects,
									// so we simply accept them as-is.
									delta[key] = [Op.Copy, clone(bVal)];
								}
							}

							// Values are objects of different reported types.
							else {
								delta[key] = [Op.Copy, clone(bVal)];
							}
						}
					}

					// Values are of different types.
					else {
						delta[key] = [
							Op.Copy,
							typeof bVal !== 'object' || bVal === null ? bVal : clone(bVal)
						];
					}
				}

				// Key exists only in `a`.
				else {
					if (aIsArray && isNumeric(key)) {
						const index = Number(key);

						if (!aOpKey) {
							aOpKey = '';

							do {
								aOpKey += '~';
							} while (keys.some(isAOpKey));

							delta[aOpKey] = [Op.SpliceArray, index, index];
						}

						if (index < delta[aOpKey][1]) {
							delta[aOpKey][1] = index;
						}

						if (index > delta[aOpKey][2]) {
							delta[aOpKey][2] = index;
						}
					}
					else {
						delta[key] = Op.Delete;
					}
				}
			}

			// Key exists only in `b`.
			else {
				delta[key] = [
					Op.Copy,
					typeof bVal !== 'object' || bVal === null ? bVal : clone(bVal)
				];
			}
		}
		/* eslint-enable max-depth */

		return Object.keys(delta).length > 0 ? delta : null;
	}

	// Returns the object resulting from updating the `orig` object with the
	// `delta` object.
	function patch(orig, delta) /* patched object */ {
		const keys    = delta ? Object.keys(delta) : [];
		const patched = clone(orig);

		for (let i = 0, klen = keys.length; i < klen; ++i) {
			const key   = keys[i];
			const value = delta[key];

			if (value === Op.Delete) {
				delete patched[key];
			}
			else if (value instanceof Array) {
				switch (value[0]) {
					case Op.SpliceArray:
						patched.splice(value[1], value[2] - value[1] + 1);
						break;

					case Op.Copy:
						patched[key] = clone(value[1]);
						break;

					/* legacy */
					case Op.CopyDate:
						patched[key] = new Date(value[1]);
						break;
					/* /legacy */
				}
			}
			else {
				patched[key] = patch(patched[key], value);
			}
		}

		return patched;
	}


	/*******************************************************************************
		Object Exports.
	*******************************************************************************/

	return Object.preventExtensions(Object.create(null, {
		Op    : { value : Op },
		diff  : { value : diff },
		patch : { value : patch }
	}));
})();

/***********************************************************************************************************************

	l10n/l10n.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global l10nStrings, strings */

var L10n = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Replacement pattern regular expressions.
	const _patternRe    = /\{\w+\}/g;
	const _hasPatternRe = new RegExp(_patternRe.source); // to drop the global flag


	/*******************************************************************************************************************
		Localization Functions.
	*******************************************************************************************************************/
	function l10nInit() {
		/* legacy */
		_mapStringsToL10nStrings();
		/* /legacy */
	}

	/*******************************************************************************************************************
		Localized String Functions.
	*******************************************************************************************************************/
	function l10nGet(ids, overrides) {
		if (!ids) {
			return '';
		}

		const id = (idList => {
			let selectedId;
			idList.some(id => {
				if (l10nStrings.hasOwnProperty(id)) {
					selectedId = id;
					return true;
				}

				return false;
			});
			return selectedId;
		})(Array.isArray(ids) ? ids : [ids]);

		if (!id) {
			return '';
		}

		const maxIterations = 50;
		let processed = l10nStrings[id];
		let iteration = 0;

		while (_hasPatternRe.test(processed)) {
			if (++iteration > maxIterations) {
				throw new Error('L10n.get exceeded maximum replacement iterations, probable infinite loop');
			}

			// Possibly required by some old buggy browsers.
			_patternRe.lastIndex = 0;

			processed = processed.replace(_patternRe, pat => {
				const subId = pat.slice(1, -1);

				if (overrides && overrides.hasOwnProperty(subId)) {
					return overrides[subId];
				}
				else if (l10nStrings.hasOwnProperty(subId)) {
					return l10nStrings[subId];
				}
			});
		}

		return processed;
	}


	/*******************************************************************************************************************
		Legacy Functions.
	*******************************************************************************************************************/
	/*
		Attempt to map legacy `strings` object properties to the `l10nStrings` object.
	*/
	function _mapStringsToL10nStrings() {
		if (strings && Object.keys(strings).length > 0) {
			Object.keys(l10nStrings).forEach(id => {
				try {
					let value;

					switch (id) {
					/*
						General.
					*/
					case 'identity': value = strings.identity; break;
					case 'aborting': value = strings.aborting; break;
					case 'cancel':   value = strings.cancel; break;
					case 'close':    value = strings.close; break;
					case 'ok':       value = strings.ok; break;

					/*
						Errors.
					*/
					case 'errorTitle':              value = strings.errors.title; break;
					case 'errorNonexistentPassage': value = strings.errors.nonexistentPassage; break;
					case 'errorSaveMissingData':    value = strings.errors.saveMissingData; break;
					case 'errorSaveIdMismatch':     value = strings.errors.saveIdMismatch; break;

					/*
						Warnings.
					*/
					case 'warningDegraded': value = strings.warnings.degraded; break;

					/*
						Debug View.
					*/
					case 'debugViewTitle':  value = strings.debugView.title; break;
					case 'debugViewToggle': value = strings.debugView.toggle; break;

					/*
						UI bar.
					*/
					case 'uiBarToggle':   value = strings.uiBar.toggle; break;
					case 'uiBarBackward': value = strings.uiBar.backward; break;
					case 'uiBarForward':  value = strings.uiBar.forward; break;
					case 'uiBarJumpto':   value = strings.uiBar.jumpto; break;

					/*
						Jump To.
					*/
					case 'jumptoTitle':       value = strings.jumpto.title; break;
					case 'jumptoTurn':        value = strings.jumpto.turn; break;
					case 'jumptoUnavailable': value = strings.jumpto.unavailable; break;

					/*
						Saves.
					*/
					case 'savesTitle':       value = strings.saves.title; break;
					case 'savesDisallowed':  value = strings.saves.disallowed; break;
					case 'savesIncapable':   value = strings.saves.incapable; break;
					case 'savesLabelAuto':   value = strings.saves.labelAuto; break;
					case 'savesLabelDelete': value = strings.saves.labelDelete; break;
					case 'savesLabelExport': value = strings.saves.labelExport; break;
					case 'savesLabelImport': value = strings.saves.labelImport; break;
					case 'savesLabelLoad':   value = strings.saves.labelLoad; break;
					case 'savesLabelClear':  value = strings.saves.labelClear; break;
					case 'savesLabelSave':   value = strings.saves.labelSave; break;
					case 'savesLabelSlot':   value = strings.saves.labelSlot; break;
					case 'savesUnavailable': value = strings.saves.unavailable; break;
					case 'savesUnknownDate': value = strings.saves.unknownDate; break;

					/*
						Settings.
					*/
					case 'settingsTitle': value = strings.settings.title; break;
					case 'settingsOff':   value = strings.settings.off; break;
					case 'settingsOn':    value = strings.settings.on; break;
					case 'settingsReset': value = strings.settings.reset; break;

					/*
						Restart.
					*/
					case 'restartTitle':  value = strings.restart.title; break;
					case 'restartPrompt': value = strings.restart.prompt; break;

					/*
						Share.
					*/
					case 'shareTitle': value = strings.share.title; break;

					/*
						Alert.
					*/
					case 'alertTitle': /* none */ break;

					/*
						Autoload.
					*/
					case 'autoloadTitle':  value = strings.autoload.title; break;
					case 'autoloadCancel': value = strings.autoload.cancel; break;
					case 'autoloadOk':     value = strings.autoload.ok; break;
					case 'autoloadPrompt': value = strings.autoload.prompt; break;

					/*
						Macros.
					*/
					case 'macroBackText':   value = strings.macros.back.text; break;
					case 'macroReturnText': value = strings.macros.return.text; break;
					}

					if (value) {
						l10nStrings[id] = value.replace(/%\w+%/g, pat => `{${pat.slice(1, -1)}}`);
					}
				}
				catch (ex) { /* no-op */ }
			});
		}
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Localization Functions.
		*/
		init : { value : l10nInit },

		/*
			Localized String Functions.
		*/
		get : { value : l10nGet }
	}));
})();

/***********************************************************************************************************************

	l10n/legacy.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

/*
	[DEPRECATED] The `strings` object is deprecated and should no longer be used.
	All new or updated translations should be based upon the `l10nStrings` object
	(see: `l10n/strings.js`).

	Legacy/existing uses of the `strings` object will be mapped to the `l10nStrings`
	object after user script evaluation.
*/
var strings = { // eslint-disable-line no-unused-vars, no-var
	errors    : {},
	warnings  : {},
	debugView : {},
	uiBar     : {},
	jumpto    : {},
	saves     : {},
	settings  : {},
	restart   : {},
	share     : {},
	autoload  : {},
	macros    : {
		back   : {},
		return : {}
	}
};

/***********************************************************************************************************************

	l10n/strings.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* eslint-disable max-len, prefer-template */

/*
	ATTENTION TRANSLATORS

	Please use the `locale/l10n-template.js` file, from the root of the repository,
	as the template for your translation rather than this file.

	SEE: https://github.com/tmedwards/sugarcube-2/tree/develop/locale
*/
var l10nStrings = { // eslint-disable-line no-unused-vars, no-var
	/*
		General.
	*/
	identity : 'game',
	aborting : 'Aborting',
	cancel   : 'Cancel',
	close    : 'Close',
	ok       : 'OK',

	/*
		Errors.
	*/
	errorTitle              : 'Error',
	errorToggle             : 'Toggle the error view',
	errorNonexistentPassage : 'the passage "{passage}" does not exist', // NOTE: `passage` is supplied locally
	errorSaveDiskLoadFailed : 'failed to load save file from disk',
	errorSaveMissingData    : 'save is missing required data. Either the loaded file is not a save or the save has become corrupted',
	errorSaveIdMismatch     : 'save is from the wrong {identity}',

	/*
		Warnings.
	*/
	_warningIntroLacking  : 'Your browser either lacks or has disabled',
	_warningOutroDegraded : ', so this {identity} is running in a degraded mode. You may be able to continue, however, some parts may not work properly.',
	warningNoWebStorage   : '{_warningIntroLacking} the Web Storage API{_warningOutroDegraded}',
	warningDegraded       : '{_warningIntroLacking} some of the capabilities required by this {identity}{_warningOutroDegraded}',

	/*
		Debug bar.
	*/
	debugBarToggle      : 'Toggle the debug bar',
	debugBarNoWatches   : '\u2014 no watches set \u2014',
	debugBarAddWatch    : 'Add watch',
	debugBarDeleteWatch : 'Delete watch',
	debugBarWatchAll    : 'Watch all',
	debugBarWatchNone   : 'Delete all',
	debugBarLabelAdd    : 'Add',
	debugBarLabelWatch  : 'Watch',
	debugBarLabelTurn   : 'Turn', // (noun) chance to act (in a game), moment, period
	debugBarLabelViews  : 'Views',
	debugBarViewsToggle : 'Toggle the debug views',
	debugBarWatchToggle : 'Toggle the watch panel',

	/*
		UI bar.
	*/
	uiBarToggle   : 'Toggle the UI bar',
	uiBarBackward : 'Go backward within the {identity} history',
	uiBarForward  : 'Go forward within the {identity} history',
	uiBarJumpto   : 'Jump to a specific point within the {identity} history',

	/*
		Jump To.
	*/
	jumptoTitle       : 'Jump To',
	jumptoTurn        : 'Turn', // (noun) chance to act (in a game), moment, period
	jumptoUnavailable : 'No jump points currently available\u2026',

	/*
		Saves.
	*/
	savesTitle       : 'Saves',
	savesDisallowed  : 'You can\'t save on this passage!',
	savesIncapable   : '{_warningIntroLacking} the capabilities required to support saves, so saves have been disabled for this session.',
	savesLabelAuto   : 'Autosave',
	savesLabelDelete : 'Delete ',
	savesLabelExport : 'Save to File\u2026',
	savesLabelImport : 'Load from File\u2026',
	savesLabelLoad   : 'Load ',
	savesLabelClear  : 'Delete All',
	savesLabelSave   : 'Save',
	savesLabelSlot   : 'Slot',
	savesUnavailable : 'No save slots found\u2026',
	savesUnknownDate : 'unknown',

	/*
		idb related
	*/
	savesDisallowedReplay     : 'The scene viewer is currently in use, preventing the use of the save system.',
	savesExportReminder       : 'Warning: If your browser cache is cleared, saves here will be lost! Consider saving to file every so often!',
	savesHeaderSaveLoad       : 'Save/Load',
	savesHeaderIDName         : 'ID/Name',
	savesHeaderDetails        : 'Details',
	savesDescTitle            : 'Title: ',
	savesDescName             : 'Save Name: ',
	savesDescId               : 'Save Id: ',
	savesDescDate             : 'Date: ',
	savesPagerJump            : 'Jump to most recent manual save',
	savesPagerPage            : 'Page:',
	savesPagerSavesPerPage    : 'Saves per page:',
	savesOptionsConfirmOn     : 'Require confirmation on:',
	savesOptionsOverwrite     : 'Overwrite ',
	savesOptionsUseLegacy     : 'Switch to legacy save storage',
	savesWarningSaveOnSlot    : 'Save on slot',
	savesWarningOverwriteSlot : 'Overwrite save in slot',
	savesWarningOverwriteID   : 'Save ID does not match, continue with overwrite?',
	savesWarningDeleteInSlot  : 'Delete save in slot',
	savesWarningLoad          : 'Load slot',
	savesWarningDeleteAll     : 'WARNING - DO YOU REALLY WANT TO DELETE ALL SAVES?',
	savesLabelToClipboard     : 'Save to Clipboard\u2026',

	/*
		Settings.
	*/
	settingsTitle : 'Settings',
	settingsOff   : 'Off',
	settingsOn    : 'On',
	settingsReset : 'Reset to Defaults',

	/*
		Restart.
	*/
	restartTitle  : 'Restart',
	restartPrompt : 'Are you sure that you want to restart? Unsaved progress will be lost.',

	/*
		Share.
	*/
	shareTitle : 'Share',

	/*
		Alert.
	*/
	alertTitle : 'Alert',

	/*
		Autoload.
	*/
	autoloadTitle  : 'Autoload',
	autoloadCancel : 'Go to start',
	autoloadOk     : 'Load autosave',
	autoloadPrompt : 'An autosave exists. Load it now or go to the start?',

	/*
		Macros.
	*/
	macroBackText   : 'Back',  // (verb) rewind, revert
	macroReturnText : 'Return' // (verb) go/send back
};

/***********************************************************************************************************************

	config.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Save, Util */

var Config = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// General settings.
	let _debug                 = false;
	let _addVisitedLinkClass   = false;
	let _cleanupWikifierOutput = false;
	let _loadDelay             = 0;

	// Audio settings.
	let _audioPauseOnFadeToZero = true;
	let _audioPreloadMetadata   = true;

	// State history settings.
	let _historyControls  = true;
	let _historyMaxStates = 40;
	let _sessionMaxStates = 40;
	let _expiredMaxStates = 100;

	// Macros settings.
	let _macrosIfAssignmentError   = true;
	let _macrosMaxLoopIterations   = 1000;
	let _macrosTypeSkipKey         = '\x20'; // Space
	let _macrosTypeVisitedPassages = true;

	// Navigation settings.
	let _navigationOverride;
	let _navigationRememberYPos;
	let _navigationGoToHell;

	// Passages settings.
	let _passagesDescriptions;
	let _passagesDisplayTitles = false;
	let _passagesNobr          = false;
	let _passagesStart; // set by `Story.load()`
	let _passagesOnProcess;
	let _passagesTransitionOut;

	// Saves settings.
	let _savesAutoload;
	let _savesAutosave;
	let _savesId              = 'untitled-story';
	let _savesIsAllowed;
	let _savesSlots           = 8;
	let _savesTryDiskOnMobile = true;
	let _savesVersion;
	let _savesUseLZString     = -1; // try autodetect

	// UI settings.
	let _uiStowBarInitially    = 800;
	let _uiUpdateStoryElements = true;


	/*******************************************************************************
		Error Constants.
	*******************************************************************************/

	const _errHistoryModeDeprecated     = 'Config.history.mode has been deprecated and is no longer used by SugarCube, please remove it from your code';
	const _errHistoryTrackingDeprecated = 'Config.history.tracking has been deprecated, use Config.history.maxStates instead';
	const _errSavesOnLoadDeprecated     = 'Config.saves.onLoad has been deprecated, use the Save.onLoad API instead';
	const _errSavesOnSaveDeprecated     = 'Config.saves.onSave has been deprecated, use the Save.onSave API instead';


	/*******************************************************************************
		Object Exports.
	*******************************************************************************/

	return Object.freeze({
		/*
			General settings.
		*/
		get debug() { return _debug; },
		set debug(value) { _debug = Boolean(value); },

		get addVisitedLinkClass() { return _addVisitedLinkClass; },
		set addVisitedLinkClass(value) { _addVisitedLinkClass = Boolean(value); },

		get cleanupWikifierOutput() { return _cleanupWikifierOutput; },
		set cleanupWikifierOutput(value) { _cleanupWikifierOutput = Boolean(value); },

		get loadDelay() { return _loadDelay; },
		set loadDelay(value) {
			if (!Number.isSafeInteger(value) || value < 0) {
				throw new RangeError('Config.loadDelay must be a non-negative integer');
			}

			_loadDelay = value;
		},

		/*
			Audio settings.
		*/
		audio : Object.freeze({
			get pauseOnFadeToZero() { return _audioPauseOnFadeToZero; },
			set pauseOnFadeToZero(value) { _audioPauseOnFadeToZero = Boolean(value); },

			get preloadMetadata() { return _audioPreloadMetadata; },
			set preloadMetadata(value) { _audioPreloadMetadata = Boolean(value); }
		}),

		/*
			State history settings.
		*/
		history : Object.freeze({
			// TODO: (v3) This should be under UI settings → `Config.ui.historyControls`.
			get controls() { return _historyControls; },
			set controls(value) {
				const controls = Boolean(value);

				if (_historyMaxStates === 1 && controls) {
					throw new Error('Config.history.controls must be false when Config.history.maxStates is 1');
				}

				_historyControls = controls;
			},

			get maxStates() { return _historyMaxStates; },
			set maxStates(value) {
				if (!Number.isSafeInteger(value) || value < 1) {
					throw new RangeError('Config.history.maxStates must be a positive integer');
				}

				_historyMaxStates = value;

				// Force `Config.history.controls` to `false`, when limited to `1` moment.
				if (_historyControls && value === 1) {
					_historyControls = false;
				}
			},

			get maxSessionStates() { return _sessionMaxStates; },
			set maxSessionStates(value) {
				if (!Number.isSafeInteger(value) || value < 0) {
					throw new RangeError('Config.history.maxSessionStates must be a non-negative integer');
				}

				_sessionMaxStates = value;
			},

			get maxExpired() { return _expiredMaxStates; },
			set maxExpired(value) {
				_expiredMaxStates = value;
			},

			// legacy
			// Die if deprecated state history settings are accessed.
			get mode()  { throw new Error(_errHistoryModeDeprecated); },
			set mode(_) { throw new Error(_errHistoryModeDeprecated); },
			get tracking()  { throw new Error(_errHistoryTrackingDeprecated); },
			set tracking(_) { throw new Error(_errHistoryTrackingDeprecated); }
			// /legacy
		}),

		/*
			Macros settings.
		*/
		macros : Object.freeze({
			get ifAssignmentError() { return _macrosIfAssignmentError; },
			set ifAssignmentError(value) { _macrosIfAssignmentError = Boolean(value); },

			get maxLoopIterations() { return _macrosMaxLoopIterations; },
			set maxLoopIterations(value) {
				if (!Number.isSafeInteger(value) || value < 1) {
					throw new RangeError('Config.macros.maxLoopIterations must be a positive integer');
				}

				_macrosMaxLoopIterations = value;
			},

			get typeSkipKey() { return _macrosTypeSkipKey; },
			set typeSkipKey(value) { _macrosTypeSkipKey = String(value); },

			get typeVisitedPassages() { return _macrosTypeVisitedPassages; },
			set typeVisitedPassages(value) { _macrosTypeVisitedPassages = Boolean(value); }
		}),

		/*
			Navigation settings.
		*/
		navigation : Object.freeze({
			get override() { return _navigationOverride; },
			set override(value) {
				if (!(value == null || value instanceof Function)) { // lazy equality for null
					throw new TypeError(`Config.navigation.override must be a function or null/undefined (received: ${Util.getType(value)})`);
				}

				_navigationOverride = value;
			},
			get gotohell() { return _navigationGoToHell; },
			set gotohell(value) { _navigationGoToHell = value; },
			get rememberYPos() { return _navigationRememberYPos; },
			set rememberYPos(value) { _navigationRememberYPos = value; }
		}),

		/*
			Passages settings.
		*/
		passages : Object.freeze({
			get descriptions() { return _passagesDescriptions; },
			set descriptions(value) {
				if (value != null) { // lazy equality for null
					const valueType = Util.getType(value);

					if (valueType !== 'boolean' && valueType !== 'Object' && valueType !== 'function') {
						throw new TypeError(`Config.passages.descriptions must be a boolean, object, function, or null/undefined (received: ${valueType})`);
					}
				}

				_passagesDescriptions = value;
			},

			// TODO: (v3) This should be under Navigation settings → `Config.navigation.updateTitle`.
			get displayTitles() { return _passagesDisplayTitles; },
			set displayTitles(value) { _passagesDisplayTitles = Boolean(value); },

			get nobr() { return _passagesNobr; },
			set nobr(value) { _passagesNobr = Boolean(value); },

			get onProcess() { return _passagesOnProcess; },
			set onProcess(value) {
				if (value != null) { // lazy equality for null
					const valueType = Util.getType(value);

					if (valueType !== 'function') {
						throw new TypeError(`Config.passages.onProcess must be a function or null/undefined (received: ${valueType})`);
					}
				}

				_passagesOnProcess = value;
			},

			// TODO: (v3) This should be under Navigation settings → `Config.navigation.(start|startingPassage)`.
			get start() { return _passagesStart; },
			set start(value) {
				if (value != null) { // lazy equality for null
					const valueType = Util.getType(value);

					if (valueType !== 'string') {
						throw new TypeError(`Config.passages.start must be a string or null/undefined (received: ${valueType})`);
					}
				}

				_passagesStart = value;
			},

			// TODO: (v3) This should be under Navigation settings → `Config.navigation.transitionOut`.
			get transitionOut() { return _passagesTransitionOut; },
			set transitionOut(value) {
				if (value != null) { // lazy equality for null
					const valueType = Util.getType(value);

					if (
						   valueType !== 'string'
						&& (valueType !== 'number' || !Number.isSafeInteger(value) || value < 0)
					) {
						throw new TypeError(`Config.passages.transitionOut must be a string, non-negative integer, or null/undefined (received: ${valueType})`);
					}
				}

				_passagesTransitionOut = value;
			}
		}),

		/*
			Saves settings.
		*/
		saves : Object.freeze({
			get autoload() { return _savesAutoload; },
			set autoload(value) {
				if (value != null) { // lazy equality for null
					const valueType = Util.getType(value);

					if (valueType !== 'boolean' && valueType !== 'string' && valueType !== 'function') {
						throw new TypeError(`Config.saves.autoload must be a boolean, string, function, or null/undefined (received: ${valueType})`);
					}
				}

				_savesAutoload = value;
			},

			get autosave() { return _savesAutosave; },
			set autosave(value) {
				if (value != null) { // lazy equality for null
					const valueType = Util.getType(value);

					// legacy
					// Convert a string value to an Array of string.
					if (valueType === 'string') {
						_savesAutosave = [value];
						return;
					}
					// /legacy

					if (
						   valueType !== 'boolean'
						&& (valueType !== 'Array' || !value.every(item => typeof item === 'string'))
						&& valueType !== 'function'
					) {
						throw new TypeError(`Config.saves.autosave must be a boolean, Array<string>, function, or null/undefined (received: ${valueType}${valueType === 'Array' ? '<any>' : ''})`);
					}
				}

				_savesAutosave = value;
			},

			get id() { return _savesId; },
			set id(value) {
				if (typeof value !== 'string' || value === '') {
					throw new TypeError(`Config.saves.id must be a non-empty string (received: ${Util.getType(value)})`);
				}

				_savesId = value;
			},

			get isAllowed() { return _savesIsAllowed; },
			set isAllowed(value) {
				if (!(value == null || value instanceof Function)) { // lazy equality for null
					throw new TypeError(`Config.saves.isAllowed must be a function or null/undefined (received: ${Util.getType(value)})`);
				}

				_savesIsAllowed = value;
			},

			get slots() { return _savesSlots; },
			set slots(value) {
				if (!Number.isSafeInteger(value) || value < 0) {
					throw new TypeError(`Config.saves.slots must be a non-negative integer (received: ${Util.getType(value)})`);
				}

				_savesSlots = value;
			},

			get tryDiskOnMobile() { return _savesTryDiskOnMobile; },
			set tryDiskOnMobile(value) { _savesTryDiskOnMobile = Boolean(value); },

			get version() { return _savesVersion; },
			set version(value) { _savesVersion = value; },

			get useLZString() { return _savesUseLZString; },
			set useLZString(value) { return _savesUseLZString = value; },

			// legacy
			// Die if deprecated saves onLoad handler getter is accessed.
			get onLoad() { throw new Error(_errSavesOnLoadDeprecated); },
			// Warn if deprecated saves onLoad handler setter is assigned to, then
			// pass the handler to the `Save.onLoad` API for compatibilities sake.
			set onLoad(value) {
				console.warn(_errSavesOnLoadDeprecated);
				Save.onLoad.add(value);
			},

			// Die if deprecated saves onSave handler getter is accessed.
			get onSave() { throw new Error(_errSavesOnSaveDeprecated); },
			// Warn if deprecated saves onSave handler setter is assigned to, then
			// pass the handler to the `Save.onSave` API for compatibilities sake.
			set onSave(value) {
				console.warn(_errSavesOnSaveDeprecated);
				Save.onSave.add(value);
			}
			// /legacy
		}),

		/*
			UI settings.
		*/
		ui : Object.freeze({
			get stowBarInitially() { return _uiStowBarInitially; },
			set stowBarInitially(value) {
				const valueType = Util.getType(value);

				if (
					   valueType !== 'boolean'
					&& (valueType !== 'number' || !Number.isSafeInteger(value) || value < 0)
				) {
					throw new TypeError(`Config.ui.stowBarInitially must be a boolean or non-negative integer (received: ${valueType})`);
				}

				_uiStowBarInitially = value;
			},

			get updateStoryElements() { return _uiUpdateStoryElements; },
			set updateStoryElements(value) { _uiUpdateStoryElements = Boolean(value); }
		})
	});
})();

/***********************************************************************************************************************

	simpleaudio.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Config, Has, LoadScreen, Story, Util, Visibility, clone */

var SimpleAudio = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*
		Events that count as user activation—i.e. "user gestures", "activation behavior".

		NOTE (ca. Dec, 2018): This not an exhaustive list and varies significantly by browser.
		Proposals for a specification/standard are still very much in flux at this point.

		TODO (ca. Dec, 2018): Revisit this topic.

		SEE: (too many to list)
			https://github.com/whatwg/html/issues/3849
			https://github.com/whatwg/html/issues/1903
			https://html.spec.whatwg.org/#activation
			https://docs.google.com/spreadsheets/d/1DGXjhQ6D3yZXIePOMo0dsd2agz0t5W7rYH1NwJ-QGJo/edit#gid=0
	*/
	const _gestureEventNames = Object.freeze(['click', 'contextmenu', 'dblclick', 'keyup', 'mouseup', 'pointerup', 'touchend']);

	// Special group IDs.
	const _specialIds = Object.freeze([':not', ':all', ':looped', ':muted', ':paused', ':playing']);

	// Format specifier regular expression.
	const _formatSpecRe = /^([\w-]+)\s*\|\s*(\S.*)$/; // e.g. 'mp3|https://audiohost.tld/id'

	// ID verification regular expressions.
	const _badIdRe = /[:\s]/;

	// Tracks collection.
	const _tracks = new Map();

	// Groups collection.
	const _groups = new Map();

	// Playlists collection.
	const _lists = new Map();

	// Subscriber collection.
	const _subscribers = new Map();

	// Master playback rate.
	let _masterRate = 1;

	// Master playback volume.
	let _masterVolume = 1;

	// Master mute state.
	let _masterMute = false;

	// Master mute on tab/window visibility state.
	let _masterMuteOnHidden = false;


	/*******************************************************************************************************************
		Feature Detection Functions.
	*******************************************************************************************************************/
	// Return whether the `<HTMLAudioElement>.play()` method returns a `Promise`.
	//
	// NOTE: The initial result is cached for future calls.
	const _playReturnsPromise = (function () {
		// Cache of whether `<HTMLAudioElement>.play()` returns a `Promise`.
		let _hasPromise = null;

		function _playReturnsPromise() {
			if (_hasPromise !== null) {
				return _hasPromise;
			}

			_hasPromise = false;

			if (Has.audio) {
				try {
					const audio = document.createElement('audio');

					// NOTE (ca. Jan 01, 2020): Firefox will still log an "Autoplay is only allowed
					// when […] media is muted." message to the console when attempting the test
					// below, even though the audio has been muted.  Stay classy, Firefox.
					//
					// QUESTION (ca. Jan 01, 2020): Keep this?  It's only here to appease Firefox,
					// but doesn't seem to work as Firefox seems to ignore mute in violation of the
					// `HTMLAudioElement` specification—willfully or simply a bug, I can't say.
					audio.muted = true;

					const value = audio.play();

					// Silence "Uncaught (in promise)" console errors from Blink.
					//
					// NOTE: Swallowing errors is generally bad, but in this case we know there's
					// going to be an error regardless, since there's no source, and we don't actually
					// care about the error, since we just want the return value, so we consign it
					// to the bit bucket.
					//
					// NOTE: We don't ensure that the return value is not `undefined` here because
					// having the attempted call to `<Promise>.catch()` on an `undefined` value throw
					// is acceptable, since it will be caught and `false` eventually returned.
					value.catch(() => { /* no-op */ });

					_hasPromise = value instanceof Promise;
				}
				catch (ex) { /* no-op */ }
			}

			return _hasPromise;
		}

		return _playReturnsPromise;
	})();


	/*******************************************************************************************************************
		AudioTrack Class.
	*******************************************************************************************************************/
	class AudioTrack {
		constructor(obj) {
			// Process the given array of sources or AudioTrack object.
			if (obj instanceof Array) {
				this._create(obj);
			}
			else if (obj instanceof AudioTrack) {
				this._copy(obj);
			}
			else {
				throw new Error('sources parameter must be either an array, of URIs or source objects, or an AudioTrack instance');
			}
		}

		_create(sourceList) {
			const dataUriRe   = /^data:\s*audio\/(?:x-)?([^;,]+)\s*[;,]/i;
			const extRe       = /\.([^./\\]+)$/;
			const formats     = AudioTrack.formats;
			const usedSources = [];
			/*
				HTMLAudioElement: DOM factory method vs. constructor

				Use of the DOM factory method, `document.createElement('audio')`, should be
				preferred over use of the constructor, `new Audio()`.  The reason being that
				objects created by the latter are, erroneously, treated differently, often
				unfavorably, by certain browser engines—e.g. within some versions of the iOS
				browser core.

				Notably, the only difference between the two, per the specification, is that
				objects created via the constructor should have their `preload` property
				automatically set to 'auto'.  Thus, there's no technical reason to prefer
				usage of the constructor, even discounting buggy browser implementations.
			*/
			const audio = document.createElement('audio');

			// Initially set the `preload` attribute to `'none'`.
			audio.preload = 'none';

			// Process the array of sources, adding any valid sources to the `usedSources`
			// array and to the audio element as source elements.
			sourceList.forEach(src => {
				let srcUri = null;

				switch (typeof src) {
				case 'string':
					{
						let match;

						if (src.slice(0, 5) === 'data:') {
							match = dataUriRe.exec(src);

							if (match === null) {
								throw new Error('source data URI missing media type');
							}
						}
						else {
							match = extRe.exec(Util.parseUrl(src).pathname);

							if (match === null) {
								throw new Error('source URL missing file extension');
							}
						}

						if (formats[match[1]]) {
							srcUri = src;
						}
					}
					break;

				case 'object':
					{
						if (src === null) {
							throw new Error('source object cannot be null');
						}
						else if (!src.hasOwnProperty('src')) {
							throw new Error('source object missing required "src" property');
						}
						else if (!src.hasOwnProperty('format')) {
							throw new Error('source object missing required "format" property');
						}

						if (formats[src.format]) {
							srcUri = src.src;
						}
					}
					break;

				default:
					throw new Error(`invalid source value (type: ${typeof src})`);
				}

				if (srcUri !== null) {
					const source = document.createElement('source');
					source.src = srcUri;
					audio.appendChild(source);
					usedSources.push(srcUri);
				}
			});

			if (audio.hasChildNodes()) {
				// Set the `preload` attribute to `'metadata'`, unless preloading has been disabled.
				if (Config.audio.preloadMetadata) {
					audio.preload = 'metadata';
				}
			}

			this._finalize(audio, usedSources, clone(sourceList));
		}

		_copy(obj) {
			this._finalize(
				obj.audio.cloneNode(true), // deep clone of the audio element & its children
				clone(obj.sources),
				clone(obj.originals)
			);
		}

		_finalize(audio, sources, originals) {
			// Set up our own properties.
			Object.defineProperties(this, {
				audio : {
					configurable : true,
					value        : audio
				},

				sources : {
					value : Object.freeze(sources)
				},

				originals : {
					value : Object.freeze(originals)
				},

				_error : {
					writable : true,
					value    : false
				},

				_faderId : {
					writable : true,
					value    : null
				},

				_mute : {
					writable : true,
					value    : false
				},

				_rate : {
					writable : true,
					value    : 1
				},

				_volume : {
					writable : true,
					value    : 1
				}
			});

			// Set up event handlers on the audio and source elements.
			jQuery(this.audio)
				/*
					Upon receiving a `loadstart` event on the audio element, set `_error` to
					`false`.
				*/
				.on('loadstart.AudioTrack', () => this._error = false)
				/*
					Upon receiving an `error` event on the audio element, set `_error` to
					`true`.

					Caveats by browser:
						Edge violates the specification by triggering `error` events from source
						elements on their parent media element, rather than the source element.
						To enable error handling in all browsers, we set the error handler on the
						audio element and have the final source element forward its `error` event.

						IE does not trigger, at least some, `error` events from source elements at
						all, not on the source element or its parent media element.  AFAIK, nothing
						can be done about this lossage.
				*/
				.on('error.AudioTrack', () => this._error = true)
				/*
					Upon receiving an `error` event on the final source element (if any), trigger
					an `error` event on the audio element—that being necessary because the source
					`error` event does not bubble.
				*/
				.find('source:last-of-type')
				.on('error.AudioTrack', () => this._trigger('error'));

			// Subscribe to command messages.
			subscribe(this, mesg => {
				if (!this.audio) {
					unsubscribe(this);
					return;
				}

				switch (mesg) {
				case 'loadwithscreen':
					if (this.hasSource()) {
						const lockId = LoadScreen.lock();
						this
							// NOTE: Do not use an arrow function here.
							.one(
								'canplaythrough.AudioTrack_loadwithscreen error.AudioTrack_loadwithscreen',
								function () {
									jQuery(this).off('.AudioTrack_loadwithscreen');
									LoadScreen.unlock(lockId);
								}
							)
							.load();
					}
					break;
				case 'load':   this.load();               break;
				case 'mute':   this._updateAudioMute();   break;
				case 'rate':   this._updateAudioRate();   break;
				case 'stop':   this.stop();               break;
				case 'volume': this._updateAudioVolume(); break;
				case 'unload': this.unload();             break;
				}
			});

			// Synchronize with the current master audio settings.
			this._updateAudioMute();
			this._updateAudioRate();
			this._updateAudioVolume();
		}

		_trigger(eventName) {
			// Do not use `trigger()` here as we do not want these events to bubble.
			jQuery(this.audio).triggerHandler(eventName);
		}

		_destroy() {
			/*
				Strictly speaking, self-destruction is not necessary as this object will,
				eventually, be garbage collected.  That said, since the audio element contains
				data buffers for the selected audio source, which may be quite large, manually
				purging them as soon as we know that they're no longer needed is not a bad idea.
			*/
			unsubscribe(this);

			if (!this.audio) {
				return;
			}

			jQuery(this.audio).off();
			this.unload();
			this._error = true;

			// Delete the audio element property.
			delete this.audio;
		}

		clone() {
			return new AudioTrack(this);
		}

		load() {
			this.fadeStop();
			this.audio.pause();

			if (!this.audio.hasChildNodes()) {
				if (this.sources.length === 0) {
					return;
				}

				this.sources.forEach(srcUri => {
					const source = document.createElement('source');
					source.src = srcUri;
					this.audio.appendChild(source);
				});
			}

			if (this.audio.preload !== 'auto') {
				this.audio.preload = 'auto';
			}

			if (!this.isLoading()) {
				this.audio.load();
			}
		}

		unload() {
			this.fadeStop();
			this.stop();

			const audio = this.audio;
			audio.preload = 'none';

			// Remove all source elements.
			while (audio.hasChildNodes()) {
				audio.removeChild(audio.firstChild);
			}

			// Force the audio element to drop any existing data buffers.
			audio.load();
		}

		play() {
			if (!this.hasSource()) {
				return Promise.reject(new Error('none of the candidate sources were acceptable'));
			}

			if (this.isUnloaded()) {
				return Promise.reject(new Error('no sources are loaded'));
			}

			if (this.isFailed()) {
				return Promise.reject(new Error('failed to load any of the sources'));
			}

			if (this.audio.preload !== 'auto') {
				this.audio.preload = 'auto';
			}

			const namespace = '.AudioTrack_play';

			return _playReturnsPromise()
				? this.audio.play()
				: new Promise((resolve, reject) => {
					if (this.isPlaying()) {
						resolve();
					}
					else {
						jQuery(this.audio)
							.off(namespace)
							.one(`error${namespace} playing${namespace} timeupdate${namespace}`, ev => {
								jQuery(this).off(namespace);

								if (ev.type === 'error') {
									reject(new Error('unknown audio play error'));
								}
								else {
									resolve();
								}
							});
						this.audio.play();
					}
				});
		}

		playWhenAllowed() {
			this.play().catch(() => {
				const gestures = _gestureEventNames.map(name => `${name}.AudioTrack_playWhenAllowed`).join(' ');
				jQuery(document).one(gestures, () => {
					jQuery(document).off('.AudioTrack_playWhenAllowed');
					this.audio.play();
				});
			});
		}

		pause() {
			this.audio.pause();
		}

		stop() {
			this.audio.pause();
			this.time(0);
			this._trigger(':stopped');
		}

		fade(duration, toVol, fromVol) {
			if (typeof duration !== 'number') {
				throw new TypeError('duration parameter must be a number');
			}
			if (typeof toVol !== 'number') {
				throw new TypeError('toVolume parameter must be a number');
			}
			if (fromVol != null && typeof fromVol !== 'number') { // lazy equality for null
				throw new TypeError('fromVolume parameter must be a number');
			}

			if (!this.hasSource()) {
				return Promise.reject(new Error('none of the candidate sources were acceptable'));
			}

			if (this.isUnloaded()) {
				return Promise.reject(new Error('no sources are loaded'));
			}

			if (this.isFailed()) {
				return Promise.reject(new Error('failed to load any of the sources'));
			}

			this.fadeStop();

			const from = Math.clamp(fromVol == null ? this.volume() : fromVol, 0, 1); // lazy equality for null
			const to   = Math.clamp(toVol, 0, 1);

			if (from === to) {
				return;
			}

			this.volume(from);

			/*
				We listen for the `timeupdate` event here, rather than `playing`, because
				various browsers (notably, mobile browsers) are poor at firing media events
				in a timely fashion, so we use `timeupdate` to ensure that we don't start
				the fade until the track is actually progressing.
			*/
			jQuery(this.audio)
				.off('timeupdate.AudioTrack_fade')
				.one('timeupdate.AudioTrack_fade', () => {
					let min;
					let max;

					// Fade in.
					if (from < to) {
						min = from;
						max = to;
					}
					// Fade out.
					else {
						min = to;
						max = from;
					}

					const time     = Math.max(duration, 1);
					const interval = 25; // in milliseconds
					const delta    = (to - from) / (time / (interval / 1000));

					this._trigger(':fading');
					this._faderId = setInterval(() => {
						if (!this.isPlaying()) {
							/*
								While it may seem like a good idea to also set the track volume
								to the `to` value here, we should not do so.  We cannot know why
								the track is no longer playing, nor if the volume has been modified
								in the interim, so doing so now may clobber an end-user set volume.
							*/
							this.fadeStop();
							return;
						}

						this.volume(Math.clamp(this.volume() + delta, min, max));

						if (Config.audio.pauseOnFadeToZero && this.volume() === 0) {
							this.pause();
						}

						if (this.volume() === to) {
							this.fadeStop();
							this._trigger(':faded');
						}
					}, interval);
				});

			return this.play();
		}

		fadeIn(duration, fromVol) {
			return this.fade(duration, 1, fromVol);
		}

		fadeOut(duration, fromVol) {
			return this.fade(duration, 0, fromVol);
		}

		fadeStop() {
			if (this._faderId !== null) {
				clearInterval(this._faderId);
				this._faderId = null;
			}
		}

		loop(loop) {
			if (loop == null) { // lazy equality for null
				return this.audio.loop;
			}

			this.audio.loop = !!loop;

			return this;
		}

		mute(mute) {
			if (mute == null) { // lazy equality for null
				return this._mute;
			}

			this._mute = !!mute;
			this._updateAudioMute();

			return this;
		}
		_updateAudioMute() {
			this.audio.muted = this._mute || _masterMute;
		}

		rate(rate) {
			if (rate == null) { // lazy equality for null
				return this._rate;
			}

			if (typeof rate !== 'number') {
				throw new TypeError('rate parameter must be a number');
			}

			/*
				Clamp the playback rate to sane values—some browsers also do this to varying degrees.

				NOTE (ca. Aug 2016): The specification allows negative values for reverse playback,
				however, most browsers either completely ignore negative values or clamp them to
				some positive value.  In some (notably, IE & Edge), setting a negative playback
				rate breaks the associated controls, if displayed.
			*/
			/*
			this._rate = rate < 0
				? Math.clamp(rate, -0.2, -5) // clamp to 5× slower & faster, backward
				: Math.clamp(rate, 0.2, 5);  // clamp to 5× slower & faster, forward
			*/
			this._rate = Math.clamp(rate, 0.2, 5); // clamp to 5× slower & faster
			this._updateAudioRate();

			return this;
		}
		_updateAudioRate() {
			/*
			const rate = this._rate * _masterRate;
			this.audio.playbackRate = rate < 0
				? Math.clamp(rate, -0.2, -5) // clamp to 5× slower & faster, backward
				: Math.clamp(rate, 0.2, 5);  // clamp to 5× slower & faster, forward
			*/
			this.audio.playbackRate = Math.clamp(this._rate * _masterRate, 0.2, 5); // clamp to 5× slower & faster
		}

		time(time) {
			if (time == null) { // lazy equality for null
				return this.audio.currentTime;
			}

			if (typeof time !== 'number') {
				throw new TypeError('time parameter must be a number');
			}

			/*
				NOTE (historic): If we try to modify the audio clip's `.currentTime` property
				before its metadata has been loaded, it will throw an `InvalidStateError`
				(since it doesn't know its duration, allowing `.currentTime` to be set would
				be undefined behavior), so in case an exception is thrown we provide a fallback
				using the `loadedmetadata` event.

				NOTE (ca. 2016): This workaround should no longer be necessary in most browsers.
				That said, it will still be required for some time to service legacy browsers.

				NOTE (ca. Dec 09, 2018): Firefox will still log an `InvalidStateError` to the
				console when attempting to modify the clip's `.currentTime` property before its
				metadata has been loaded, even though it handles the situation properly—by waiting
				for the metadata, as all browsers do now.  To prevent this spurious logging, we
				must now manually check for the existence of the metadata and always failover to
				an event regardless of if the browser needs it or not—because I don't want to
				introduce a browser check here.  Stay classy, Firefox.
			*/
			if (this.hasMetadata()) {
				this.audio.currentTime = time;
			}
			else {
				jQuery(this.audio)
					.off('loadedmetadata.AudioTrack_time')
					.one('loadedmetadata.AudioTrack_time', () => this.audio.currentTime = time);
			}

			return this;
		}

		volume(volume) {
			if (volume == null) { // lazy equality for null
				return this._volume;
			}

			if (typeof volume !== 'number') {
				throw new TypeError('volume parameter must be a number');
			}

			this._volume = Math.clamp(volume, 0, 1); // clamp to 0 (silent) & 1 (full loudness)
			this._updateAudioVolume();

			return this;
		}
		_updateAudioVolume() {
			this.audio.volume = Math.clamp(this._volume * _masterVolume, 0, 1);
		}

		duration() {
			// NOTE: May return a double (normally), Infinity (for streams), or NaN (without metadata).
			return this.audio.duration;
		}

		remaining() {
			// NOTE: May return a double (normally), Infinity (for streams), or NaN (without metadata).
			return this.audio.duration - this.audio.currentTime;
		}

		isFailed() {
			return this._error;
		}

		isLoading() {
			return this.audio.networkState === HTMLMediaElement.NETWORK_LOADING;
		}

		isUnloaded() {
			return !this.audio.hasChildNodes();
		}

		isUnavailable() {
			return !this.hasSource() || this.isUnloaded() || this.isFailed();
		}

		isPlaying() {
			// NOTE: The `this.hasSomeData()` check is probably no longer necessary.
			return !this.audio.paused && this.hasSomeData();
		}

		isPaused() {
			/*
				If the selected audio resource is a stream, `currentTime` may return a non-zero
				value even at the earliest available position within the stream as the browser
				may have dropped the earliest chunks of buffered data or the stream may have a
				timeline which does not start at zero.

				In an attempt to guard against these possiblities, as best as we can, we test
				`duration` against `Infinity` first, which should yield true for actual streams.
			*/
			return this.audio.paused
				&& (this.audio.duration === Infinity || this.audio.currentTime > 0)
				&& !this.audio.ended;
		}

		isStopped() {
			return this.audio.paused && this.audio.currentTime === 0;
		}

		isEnded() {
			return this.audio.ended;
		}

		isFading() {
			return this._faderId !== null;
		}

		isSeeking() {
			return this.audio.seeking;
		}

		hasSource() {
			return this.sources.length > 0;
		}

		hasNoData() {
			return this.audio.readyState === HTMLMediaElement.HAVE_NOTHING;
		}

		hasMetadata() {
			return this.audio.readyState >= HTMLMediaElement.HAVE_METADATA;
		}

		hasSomeData() {
			return this.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
		}

		hasData() {
			return this.audio.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA;
		}

		on(...args) {
			jQuery.fn.on.apply(jQuery(this.audio), args);
			return this;
		}

		one(...args) {
			jQuery.fn.one.apply(jQuery(this.audio), args);
			return this;
		}

		off(...args) {
			jQuery.fn.off.apply(jQuery(this.audio), args);
			return this;
		}
	}

	// Attach the static data members.
	Object.defineProperties(AudioTrack, {
		/*
			Cache of supported (common) audio formats.

			NOTE: Caveats by browser/engine:
				Opera ≤12 (Presto) will return a false-negative if the codecs value is quoted
				with single quotes, requiring the use of either double quotes or no quotes.

				Some versions of Blink-based browsers (e.g. Chrome, Opera ≥15) will return a
				false-negative for WAVE audio if the preferred MIME-type of 'audio/wave' is
				specified, requiring the addition of 'audio/wav' for them.
		*/
		formats : {
			value : (() => {
				const audio = document.createElement('audio');
				const types = new Map();

				function canPlay(mimeType) {
					if (!types.has(mimeType)) {
						// Some early implementations return 'no' instead of the empty string.
						types.set(mimeType, audio.canPlayType(mimeType).replace(/^no$/i, '') !== '');
					}

					return types.get(mimeType);
				}

				return Object.assign(Object.create(null), {
					// AAC — MPEG-2 AAC audio; specific profiles vary, but commonly "AAC-LC".
					aac : canPlay('audio/aac'),

					// CAF — Codecs vary.
					caf : canPlay('audio/x-caf') || canPlay('audio/caf'),

					// FLAC.
					flac : canPlay('audio/x-flac') || canPlay('audio/flac'),

					// MP3 — MPEG-1/-2 Layer-III audio.
					mp3  : canPlay('audio/mpeg; codecs="mp3"') || canPlay('audio/mpeg') || canPlay('audio/mp3') || canPlay('audio/mpa'),
					mpeg : canPlay('audio/mpeg'),

					// MP4 — Codecs vary, but commonly "mp4a.40.2" (a.k.a. "AAC-LC").
					m4a : canPlay('audio/x-m4a') || canPlay('audio/m4a') || canPlay('audio/aac'),
					mp4 : canPlay('audio/x-mp4') || canPlay('audio/mp4') || canPlay('audio/aac'),

					// OGG — Codecs vary, but commonly "vorbis" and, more recently, "opus".
					ogg : canPlay('audio/ogg'),
					oga : canPlay('audio/ogg'),

					// OPUS — Opus audio in an Ogg container.
					opus : canPlay('audio/ogg; codecs="opus"') || canPlay('audio/opus'),

					// WAVE — Codecs vary, but commonly "1" (1 is the FourCC for PCM/LPCM).
					wav  : canPlay('audio/wave; codecs="1"') || canPlay('audio/wav; codecs="1"') || canPlay('audio/wave') || canPlay('audio/wav'),
					wave : canPlay('audio/wave; codecs="1"') || canPlay('audio/wav; codecs="1"') || canPlay('audio/wave') || canPlay('audio/wav'),

					// WEBM — Codecs vary, but commonly "vorbis" and, more recently, "opus".
					weba : canPlay('audio/webm'),
					webm : canPlay('audio/webm')
				});
			})()
		}
	});


	/*******************************************************************************************************************
		AudioList Class.
	*******************************************************************************************************************/
	class AudioList {
		constructor(obj) {
			// Process the given array of track objects or AudioList object.
			if (obj instanceof Array) {
				this._create(obj);
			}
			else if (obj instanceof AudioList) {
				this._copy(obj);
				// this._create(obj.tracks);
			}
			else {
				throw new Error('tracks parameter must be either an array, of track objects, or an AudioTrack instance');
			}
		}

		_create(trackList) {
			// Map the array of tracks to playlist track objects.
			this._finalize(trackList.map(trackObj => {
				if (typeof trackObj !== 'object') { // lazy equality for null
					throw new Error('tracks parameter array members must be objects');
				}

				let own;
				let rate;
				let track;
				let volume;

				if (trackObj instanceof AudioTrack) {
					own    = true;
					rate   = trackObj.rate();
					track  = trackObj.clone();
					volume = trackObj.volume();
				}
				else {
					if (!trackObj.hasOwnProperty('track')) {
						throw new Error('track object missing required "track" property');
					}
					else if (!(trackObj.track instanceof AudioTrack)) {
						throw new Error('track object\'s "track" property must be an AudioTrack object');
					}
					// else if (!trackObj.hasOwnProperty('volume')) {
					// 	throw new Error('track object missing required "volume" property');
					// }

					own    = trackObj.hasOwnProperty('own') && trackObj.own;
					rate   = trackObj.hasOwnProperty('rate') ? trackObj.rate : trackObj.track.rate();
					track  = trackObj.track;
					volume = trackObj.hasOwnProperty('volume') ? trackObj.volume : trackObj.track.volume();
				}

				track.stop();
				track.loop(false);
				track.mute(false);
				track.rate(rate);
				track.volume(volume);
				track.on('ended.AudioList', () => this._onEnd());

				return { own, track, volume, rate };
			}));
		}

		_copy(obj) {
			this._finalize(clone(obj.tracks));
		}

		_finalize(tracks) {
			// Set up our own properties.
			Object.defineProperties(this, {
				tracks : {
					configurable : true,
					value        : Object.freeze(tracks)
				},

				queue : {
					configurable : true,
					value        : []
				},

				current : {
					writable : true,
					value    : null
				},

				_rate : {
					writable : true,
					value    : 1
				},

				_volume : {
					writable : true,
					value    : 1
				},

				_mute : {
					writable : true,
					value    : false
				},

				_loop : {
					writable : true,
					value    : false
				},

				_shuffle : {
					writable : true,
					value    : false
				}
			});
		}

		_destroy() {
			/*
				Strictly speaking, self-destruction is not necessary as this object will,
				eventually, be garbage collected.
			*/
			// Stop playback.
			this.stop();

			// Destroy all owned tracks.
			this.tracks
				.filter(trackObj => trackObj.own)
				.forEach(trackObj => trackObj.track._destroy());

			// Delete the reference-type properties.
			delete this.tracks;
			delete this.queue;
		}

		load() {
			this.tracks.forEach(trackObj => trackObj.track.load());
		}

		unload() {
			this.stop();
			this.tracks.forEach(trackObj => trackObj.track.unload());
		}

		play() {
			if (this.current === null || this.current.track.isUnavailable() || this.current.track.isEnded()) {
				if (this.queue.length === 0) {
					this._fillQueue();
				}

				if (!this._next()) {
					return Promise.reject(new Error('no tracks were available'));
				}
			}

			return this.current.track.play();
		}

		playWhenAllowed() {
			this.play().catch(() => {
				const gestures = _gestureEventNames.map(name => `${name}.AudioList_playWhenAllowed`).join(' ');
				jQuery(document).one(gestures, () => {
					jQuery(document).off('.AudioList_playWhenAllowed');
					this.play();
				});
			});
		}

		pause() {
			if (this.current !== null) {
				this.current.track.pause();
			}
		}

		stop() {
			if (this.current !== null) {
				this.current.track.stop();
				this.current = null;
			}

			this._drainQueue();
		}

		skip() {
			if (this._next()) {
				this.current.track.play();
			}
			else if (this._loop) {
				this.play();
			}
		}

		fade(duration, toVol, fromVol) {
			if (typeof duration !== 'number') {
				throw new TypeError('duration parameter must be a number');
			}
			if (typeof toVol !== 'number') {
				throw new TypeError('toVolume parameter must be a number');
			}
			if (fromVol != null && typeof fromVol !== 'number') { // lazy equality for null
				throw new TypeError('fromVolume parameter must be a number');
			}

			if (this.queue.length === 0) {
				this._fillQueue();
			}

			if (this.current === null || this.current.track.isUnavailable() || this.current.track.isEnded()) {
				if (!this._next()) {
					return;
				}
			}

			const adjToVol = Math.clamp(toVol, 0, 1) * this.current.volume;
			let adjFromVol;

			if (fromVol != null) { // lazy equality for null
				adjFromVol = Math.clamp(fromVol, 0, 1) * this.current.volume;
			}

			this._volume = toVol; // NOTE: Kludgey, but necessary.

			return this.current.track.fade(duration, adjToVol, adjFromVol);
		}

		fadeIn(duration, fromVol) {
			return this.fade(duration, 1, fromVol);
		}

		fadeOut(duration, fromVol) {
			return this.fade(duration, 0, fromVol);
		}

		fadeStop() {
			if (this.current !== null) {
				this.current.track.fadeStop();
			}
		}

		loop(loop) {
			if (loop == null) { // lazy equality for null
				return this._loop;
			}

			this._loop = !!loop;

			return this;
		}

		mute(mute) {
			if (mute == null) { // lazy equality for null
				return this._mute;
			}

			this._mute = !!mute;

			if (this.current !== null) {
				this.current.track.mute(this._mute);
			}

			return this;
		}

		rate(rate) {
			if (rate == null) { // lazy equality for null
				return this._rate;
			}

			if (typeof rate !== 'number') {
				throw new TypeError('rate parameter must be a number');
			}

			this._rate = Math.clamp(rate, 0.2, 5); // clamp to 5× slower & faster

			if (this.current !== null) {
				this.current.track.rate(this._rate * this.current.rate);
			}

			return this;
		}

		shuffle(shuffle) {
			if (shuffle == null) { // lazy equality for null
				return this._shuffle;
			}

			this._shuffle = !!shuffle;

			if (this.queue.length > 0) {
				this._fillQueue();

				// Try not to immediately replay the last track when not shuffling.
				if (!this._shuffle && this.current !== null && this.queue.length > 1) {
					const firstIdx = this.queue.findIndex(trackObj => trackObj === this.current);

					if (firstIdx !== -1) {
						this.queue.push(...this.queue.splice(0, firstIdx + 1));
					}
				}
			}

			return this;
		}

		volume(volume) {
			if (volume == null) { // lazy equality for null
				return this._volume;
			}

			if (typeof volume !== 'number') {
				throw new TypeError('volume parameter must be a number');
			}

			this._volume = Math.clamp(volume, 0, 1); // clamp to 0 (silent) & 1 (full loudness)

			if (this.current !== null) {
				this.current.track.volume(this._volume * this.current.volume);
			}

			return this;
		}

		duration() {
			if (arguments.length > 0) {
				throw new Error('duration takes no parameters');
			}

			// NOTE: May return a double (normally), Infinity (for streams), or NaN (without metadata).
			return this.tracks
				.map(trackObj => trackObj.track.duration())
				.reduce((prev, cur) => prev + cur, 0);
		}

		remaining() {
			if (arguments.length > 0) {
				throw new Error('remaining takes no parameters');
			}

			// NOTE: May return a double (normally), Infinity (for streams), or NaN (without metadata).
			let remainingTime = this.queue
				.map(trackObj => trackObj.track.duration())
				.reduce((prev, cur) => prev + cur, 0);

			if (this.current !== null) {
				remainingTime += this.current.track.remaining();
			}

			return remainingTime;
		}

		time() {
			if (arguments.length > 0) {
				throw new Error('time takes no parameters');
			}

			return this.duration() - this.remaining();
		}

		isPlaying() {
			return this.current !== null && this.current.track.isPlaying();
		}

		isPaused() {
			return this.current === null || this.current.track.isPaused();
		}

		isStopped() {
			return this.queue.length === 0 && this.current === null;
		}

		isEnded() {
			return this.queue.length === 0 && (this.current === null || this.current.track.isEnded());
		}

		isFading() {
			return this.current !== null && this.current.track.isFading();
		}

		_next() {
			if (this.current !== null) {
				this.current.track.stop();
				this.current = null;
			}

			let nextTrack;

			while ((nextTrack = this.queue.shift())) {
				if (!nextTrack.track.isUnavailable()) {
					this.current = nextTrack;
					break;
				}
			}

			if (this.current === null) {
				return false;
			}

			this.current.track.mute(this._mute);
			this.current.track.rate(this._rate * this.current.rate);
			this.current.track.volume(this._volume * this.current.volume);

			// Attempt to protect against the `loop` state being reenabled
			// outside of the playlist.  Mostly for unowned tracks.
			//
			// TODO: Should we reapply the `ended` event handler too?
			this.current.track.loop(false);

			return true;
		}

		_onEnd() {
			if (this.queue.length === 0) {
				if (!this._loop) {
					return;
				}

				this._fillQueue();
			}

			if (!this._next()) {
				return;
			}

			this.current.track.play();
		}

		_drainQueue() {
			this.queue.splice(0);
		}

		_fillQueue() {
			this._drainQueue();
			this.queue.push(...this.tracks.filter(trackObj => !trackObj.track.isUnavailable()));

			if (this.queue.length === 0) {
				return;
			}

			if (this._shuffle) {
				this.queue.shuffle();

				// Try not to immediately replay the last track when shuffling.
				if (this.queue.length > 1 && this.queue[0] === this.current) {
					this.queue.push(this.queue.shift());
				}
			}
		}
	}


	/*******************************************************************************************************************
		AudioRunner Class.
	*******************************************************************************************************************/
	class AudioRunner {
		constructor(list) {
			if (!(list instanceof Set || list instanceof AudioRunner)) {
				throw new TypeError('list parameter must be a Set or a AudioRunner instance');
			}

			// Set up our own properties.
			Object.defineProperties(this, {
				trackIds : {
					value : new Set(list instanceof AudioRunner ? list.trackIds : list)
				}
			});
		}

		load() {
			AudioRunner._run(this.trackIds, AudioTrack.prototype.load);
		}

		unload() {
			AudioRunner._run(this.trackIds, AudioTrack.prototype.unload);
		}

		play() {
			AudioRunner._run(this.trackIds, AudioTrack.prototype.play);
		}

		playWhenAllowed() {
			AudioRunner._run(this.trackIds, AudioTrack.prototype.playWhenAllowed);
		}

		pause() {
			AudioRunner._run(this.trackIds, AudioTrack.prototype.pause);
		}

		stop() {
			AudioRunner._run(this.trackIds, AudioTrack.prototype.stop);
		}

		fade(duration, toVol, fromVol) {
			if (duration == null || toVol == null) { // lazy equality for null
				throw new Error('fade requires parameters');
			}

			AudioRunner._run(this.trackIds, AudioTrack.prototype.fade, duration, toVol, fromVol);
		}

		fadeIn(duration, fromVol) {
			if (duration == null) { // lazy equality for null
				throw new Error('fadeIn requires a parameter');
			}

			AudioRunner._run(this.trackIds, AudioTrack.prototype.fadeIn, duration, fromVol);
		}

		fadeOut(duration, fromVol) {
			if (duration == null) { // lazy equality for null
				throw new Error('fadeOut requires a parameter');
			}

			AudioRunner._run(this.trackIds, AudioTrack.prototype.fadeOut, duration, fromVol);
		}

		fadeStop() {
			AudioRunner._run(this.trackIds, AudioTrack.prototype.fadeStop);
		}

		loop(loop) {
			if (loop == null) { // lazy equality for null
				throw new Error('loop requires a parameter');
			}

			AudioRunner._run(this.trackIds, AudioTrack.prototype.loop, loop);
			return this;
		}

		mute(mute) {
			if (mute == null) { // lazy equality for null
				throw new Error('mute requires a parameter');
			}

			AudioRunner._run(this.trackIds, AudioTrack.prototype.mute, mute);
			return this;
		}

		rate(rate) {
			if (rate == null) { // lazy equality for null
				throw new Error('rate requires a parameter');
			}

			AudioRunner._run(this.trackIds, AudioTrack.prototype.rate, rate);
			return this;
		}

		time(time) {
			if (time == null) { // lazy equality for null
				throw new Error('time requires a parameter');
			}

			AudioRunner._run(this.trackIds, AudioTrack.prototype.time, time);
			return this;
		}

		volume(volume) {
			if (volume == null) { // lazy equality for null
				throw new Error('volume requires a parameter');
			}

			AudioRunner._run(this.trackIds, AudioTrack.prototype.volume, volume);
			return this;
		}

		on(...args) {
			AudioRunner._run(this.trackIds, AudioTrack.prototype.on, ...args);
			return this;
		}

		one(...args) {
			AudioRunner._run(this.trackIds, AudioTrack.prototype.one, ...args);
			return this;
		}

		off(...args) {
			AudioRunner._run(this.trackIds, AudioTrack.prototype.off, ...args);
			return this;
		}

		static _run(ids, fn, ...args) {
			ids.forEach(id => {
				const track = _tracks.get(id);

				if (track) {
					fn.apply(track, args);
				}
			});
		}
	}


	/*******************************************************************************************************************
		Track Functions.
	*******************************************************************************************************************/
	/*
		SimpleAudio.tracks.add(trackId, sources…);

		E.g.
			SimpleAudio.tracks.add(
				'over_the_top',
				'https://audiohost.tld/id/over_the_top.mp3',
				'https://audiohost.tld/id/over_the_top.ogg'
			);
	*/
	function trackAdd(/* trackId , sources… */) {
		if (arguments.length < 2) {
			const errors = [];
			if (arguments.length < 1) { errors.push('track ID'); }
			if (arguments.length < 2) { errors.push('sources'); }
			throw new Error(`no ${errors.join(' or ')} specified`);
		}

		const id   = String(arguments[0]).trim();
		const what = `track ID "${id}"`;

		if (_badIdRe.test(id)) {
			throw new Error(`invalid ${what}: track IDs must not contain colons or whitespace`);
		}

		const sources = Array.isArray(arguments[1])
			? Array.from(arguments[1])
			: Array.from(arguments).slice(1);
		let track;

		try {
			track = _newTrack(sources);
		}
		catch (ex) {
			throw new Error(`${what}: error during track initialization: ${ex.message}`);
		}

		// If in Test Mode and no supported sources were specified, throw an error.
		if (Config.debug && !track.hasSource()) {
			throw new Error(`${what}: no supported audio sources found`);
		}

		// If a track by the given ID already exists, destroy it.
		if (_tracks.has(id)) {
			_tracks.get(id)._destroy();
		}

		// Add the track to the cache.
		_tracks.set(id, track);
	}

	function trackDelete(id) {
		if (_tracks.has(id)) {
			_tracks.get(id)._destroy();
		}

		// TODO: Should this also remove references to the track from groups and playlists?

		return _tracks.delete(id);
	}

	function trackClear() {
		_tracks.forEach(track => track._destroy());
		_tracks.clear();
	}

	function trackHas(id) {
		return _tracks.has(id);
	}

	function trackGet(id) {
		return _tracks.get(id) || null;
	}


	/*******************************************************************************************************************
		Group Functions.
	*******************************************************************************************************************/
	/*
		SimpleAudio.groups.add(groupId, trackIds…);

		E.g.
			SimpleAudio.groups.add(':ui', 'beep', 'boop', 'boing');
	*/
	function groupAdd(/* groupId , trackIds… */) {
		if (arguments.length < 2) {
			const errors = [];
			if (arguments.length < 1) { errors.push('group ID'); }
			if (arguments.length < 2) { errors.push('track IDs'); }
			throw new Error(`no ${errors.join(' or ')} specified`);
		}

		const id   = String(arguments[0]).trim();
		const what = `group ID "${id}"`;

		if (id[0] !== ':' || _badIdRe.test(id.slice(1))) {
			throw new Error(`invalid ${what}: group IDs must start with a colon and must not contain colons or whitespace`);
		}

		if (_specialIds.includes(id)) {
			throw new Error(`cannot clobber special ${what}`);
		}

		const trackIds = Array.isArray(arguments[1])
			? Array.from(arguments[1])
			: Array.from(arguments).slice(1);
		let group;

		try {
			group = new Set(trackIds.map(trackId => {
				if (!_tracks.has(trackId)) {
					throw new Error(`track "${trackId}" does not exist`);
				}

				return trackId;
			}));
		}
		catch (ex) {
			throw new Error(`${what}: error during group initialization: ${ex.message}`);
		}

		// Add the group to the cache.
		_groups.set(id, Object.freeze(Array.from(group)));
	}

	function groupDelete(id) {
		return _groups.delete(id);
	}

	function groupClear() {
		_groups.clear();
	}

	function groupHas(id) {
		return _groups.has(id);
	}

	function groupGet(id) {
		return _groups.get(id) || null;
	}


	/*******************************************************************************************************************
		Playlist Functions.
	*******************************************************************************************************************/
	/*
		SimpleAudio.lists.add(listId, sources…);
			Where `sources` may be either a track ID or descriptor (object).
			Track descriptors are either { id, [own], [rate], [volume] } or { sources, [rate], [volume] }.

		NOTE: Rate properties are currently unsupported due to poor browser support.

		E.g.
			SimpleAudio.lists.add(
				'bgm',
				'over_the_top',
				{
					id     : 'heavens_a_lie',
					volume : 0.5,
					own    : true
				},
				{
					sources : [
						'https://audiohost.tld/id/swamped.mp3',
						'https://audiohost.tld/id/swamped.ogg'
					],
					volume  : 0.75
				}
			);
	*/
	function listAdd(/* listId , sources… */) {
		if (arguments.length < 2) {
			const errors = [];
			if (arguments.length < 1) { errors.push('list ID'); }
			if (arguments.length < 2) { errors.push('track IDs'); }
			throw new Error(`no ${errors.join(' or ')} specified`);
		}

		const id   = String(arguments[0]).trim();
		const what = `list ID "${id}"`;

		if (_badIdRe.test(id)) {
			return this.error(`invalid ${what}: list IDs must not contain colons or whitespace`);
		}

		const descriptors = Array.isArray(arguments[1])
			? Array.from(arguments[1])
			: Array.from(arguments).slice(1);
		let list;

		try {
			list = new AudioList(descriptors.map(desc => {
				if (desc === null) {
					throw new Error('track descriptor must be a string or object (type: null)');
				}

				switch (typeof desc) {
				case 'string':
					// Simply a track ID, so convert it into an object.
					desc = { id : desc }; // eslint-disable-line no-param-reassign
					break;

				case 'object':
					if (!desc.hasOwnProperty('id') && !desc.hasOwnProperty('sources')) {
						throw new Error('track descriptor must contain one of either an "id" or a "sources" property');
					}
					else if (desc.hasOwnProperty('id') && desc.hasOwnProperty('sources')) {
						throw new Error('track descriptor must contain either an "id" or a "sources" property, not both');
					}
					break;

				default:
					throw new Error(`track descriptor must be a string or object (type: ${typeof desc})`);
				}

				let own;
				// let rate;
				let track;
				let volume;

				if (desc.hasOwnProperty('id')) {
					if (typeof desc.id !== 'string') {
						throw new Error('"id" property must be a string');
					}
					if (!_tracks.has(desc.id)) {
						throw new Error(`track "${desc.id}" does not exist`);
					}

					track = _tracks.get(desc.id);
				}
				else if (desc.hasOwnProperty('sources')) {
					if (!Array.isArray(desc.sources) || desc.sources.length === 0) {
						throw new Error('"sources" property must be a non-empty array');
					}
					if (desc.hasOwnProperty('own')) {
						throw new Error('"own" property is not allowed with the "sources" property');
					}

					try {
						track = _newTrack(desc.sources);
						own = true;
					}
					catch (ex) {
						throw new Error(`error during track initialization: ${ex.message}`);
					}

					// If in Test Mode and no supported sources were specified, return an error.
					if (Config.debug && !track.hasSource()) {
						throw new Error('no supported audio sources found');
					}
				}

				if (desc.hasOwnProperty('own')) {
					if (typeof desc.own !== 'boolean') {
						throw new Error('"own" property must be a boolean');
					}

					own = desc.own;

					if (own) {
						track = track.clone();
					}
				}

				// if (desc.hasOwnProperty('rate')) {
				// 	if (
				// 		   typeof desc.rate !== 'number'
				// 		|| Number.isNaN(desc.rate)
				// 		|| !Number.isFinite(desc.rate)
				// 	) {
				// 		throw new Error('"rate" property must be a finite number');
				// 	}
				//
				// 	rate = desc.rate;
				// }

				if (desc.hasOwnProperty('volume')) {
					if (
						   typeof desc.volume !== 'number'
						|| Number.isNaN(desc.volume)
						|| !Number.isFinite(desc.volume)
						|| desc.volume < 0
					) {
						throw new Error('"volume" property must be a non-negative finite number');
					}

					volume = desc.volume;
				}

				return {
					own    : own != null ? own : false, // lazy equality for null,
					// rate   : rate != null ? rate : track.rate(), // lazy equality for null,
					track,
					volume : volume != null ? volume : track.volume() // lazy equality for null
				};
			}));
		}
		catch (ex) {
			throw new Error(`${what}: error during playlist initialization: ${ex.message}`);
		}

		// If a playlist by the given ID already exists, destroy it.
		if (_lists.has(id)) {
			_lists.get(id)._destroy();
		}

		// Add the playlist to the cache.
		_lists.set(id, list);
	}

	function listDelete(id) {
		if (_lists.has(id)) {
			_lists.get(id)._destroy();
		}

		return _lists.delete(id);
	}

	function listClear() {
		_lists.forEach(list => list._destroy());
		_lists.clear();
	}

	function listHas(id) {
		return _lists.has(id);
	}

	function listGet(id) {
		return _lists.get(id) || null;
	}


	/*******************************************************************************************************************
		Runner Functions.
	*******************************************************************************************************************/
	const _runnerParseSelector = (() => {
		const notWsRe = /\S/g;
		const parenRe = /[()]/g;

		function processNegation(str, startPos) {
			let match;

			notWsRe.lastIndex = startPos;
			match = notWsRe.exec(str);

			if (match === null || match[0] !== '(') {
				throw new Error('invalid ":not()" syntax: missing parentheticals');
			}

			parenRe.lastIndex = notWsRe.lastIndex;
			const start  = notWsRe.lastIndex;
			const result = { str : '', nextMatch : -1 };
			let depth = 1;

			while ((match = parenRe.exec(str)) !== null) {
				if (match[0] === '(') {
					++depth;
				}
				else {
					--depth;
				}

				if (depth < 1) {
					result.nextMatch = parenRe.lastIndex;
					result.str = str.slice(start, result.nextMatch - 1);
					break;
				}
			}

			return result;
		}

		function parseSelector(idArg) {
			const ids  = [];
			const idRe = /:?[^\s:()]+/g;
			let match;

			while ((match = idRe.exec(idArg)) !== null) {
				const id = match[0];

				// Group negation.
				if (id === ':not') {
					if (ids.length === 0) {
						throw new Error('invalid negation: no group ID preceded ":not()"');
					}

					const parent = ids[ids.length - 1];

					if (parent.id[0] !== ':') {
						throw new Error(`invalid negation of track "${parent.id}": only groups may be negated with ":not()"`);
					}

					const negation = processNegation(idArg, idRe.lastIndex);

					if (negation.nextMatch === -1) {
						throw new Error('unknown error parsing ":not()"');
					}

					idRe.lastIndex = negation.nextMatch;
					parent.not = parseSelector(negation.str);
				}

				// Group or track ID.
				else {
					ids.push({ id });
				}
			}

			return ids;
		}

		return parseSelector;
	})();

	/*
		SimpleAudio.select(selector).…;

		E.g.
			SimpleAudio.select(':ui').…
			SimpleAudio.select(':ui:not(boop)').…
			SimpleAudio.select('boop beep').…
			SimpleAudio.select(':ui :sfx').…
			SimpleAudio.select(':ui:not(boop) :sfx overthetop').…
	*/
	function runnerGet(/* selector */) {
		if (arguments.length === 0) {
			throw new Error('no track selector specified');
		}

		const selector = String(arguments[0]).trim();
		const trackIds = new Set();

		try {
			const allIds = Array.from(_tracks.keys());

			function renderIds(idObj) {
				const id = idObj.id;
				let ids;

				switch (id) {
				case ':all':     ids = allIds; break;
				case ':looped':  ids = allIds.filter(id => _tracks.get(id).loop()); break;
				case ':muted':   ids = allIds.filter(id => _tracks.get(id).mute()); break;
				case ':paused':  ids = allIds.filter(id => _tracks.get(id).isPaused()); break;
				case ':playing': ids = allIds.filter(id => _tracks.get(id).isPlaying()); break;
				default:         ids = id[0] === ':' ? _groups.get(id) : [id]; break;
				}

				if (idObj.hasOwnProperty('not')) {
					const negated = idObj.not.map(idObj => renderIds(idObj)).flat(Infinity);
					ids = ids.filter(id => !negated.includes(id));
				}

				return ids;
			}

			_runnerParseSelector(selector).forEach(idObj => renderIds(idObj).forEach(id => {
				if (!_tracks.has(id)) {
					throw new Error(`track "${id}" does not exist`);
				}

				trackIds.add(id);
			}));
		}
		catch (ex) {
			throw new Error(`error during runner initialization: ${ex.message}`);
		}

		return new AudioRunner(trackIds);
	}


	/*******************************************************************************************************************
		Master Audio Functions.
	*******************************************************************************************************************/
	function masterLoad() {
		publish('load');
	}

	function masterLoadWithScreen() {
		publish('loadwithscreen');
	}

	function masterMute(mute) {
		if (mute == null) { // lazy equality for null
			return _masterMute;
		}

		_masterMute = !!mute;
		publish('mute', _masterMute);
	}

	function masterMuteOnHidden(mute) {
		// NOTE: Some older browsers—notably: IE 9—do not support the Page Visibility API.
		if (!Visibility.isEnabled()) {
			return false;
		}

		if (mute == null) { // lazy equality for null
			return _masterMuteOnHidden;
		}

		_masterMuteOnHidden = !!mute;

		const namespace = '.SimpleAudio_masterMuteOnHidden';

		if (_masterMuteOnHidden) {
			const visibilityChange = `${Visibility.changeEvent}${namespace}`;
			jQuery(document)
				.off(namespace)
				.on(visibilityChange, () => masterMute(Visibility.isHidden()));

			// Only change the mute state initially if hidden.
			if (Visibility.isHidden()) {
				masterMute(true);
			}
		}
		else {
			jQuery(document).off(namespace);
		}
	}

	function masterRate(rate) {
		if (rate == null) { // lazy equality for null
			return _masterRate;
		}

		if (typeof rate !== 'number' || Number.isNaN(rate) || !Number.isFinite(rate)) {
			throw new Error('rate must be a finite number');
		}

		_masterRate = Math.clamp(rate, 0.2, 5); // clamp to 5× slower & faster
		publish('rate', _masterRate);
	}

	function masterStop() {
		publish('stop');
	}

	function masterUnload() {
		publish('unload');
	}

	function masterVolume(volume) {
		if (volume == null) { // lazy equality for null
			return _masterVolume;
		}

		if (typeof volume !== 'number' || Number.isNaN(volume) || !Number.isFinite(volume)) {
			throw new Error('volume must be a finite number');
		}

		_masterVolume = Math.clamp(volume, 0, 1); // clamp to 0 (silent) & 1 (full loudness)
		publish('volume', _masterVolume);
	}


	/*******************************************************************************************************************
		Subscription Functions.
	*******************************************************************************************************************/
	function subscribe(id, callback) {
		if (typeof callback !== 'function') {
			throw new Error('callback parameter must be a function');
		}

		_subscribers.set(id, callback);
	}

	function unsubscribe(id) {
		_subscribers.delete(id);
	}

	function publish(mesg, data) {
		_subscribers.forEach(fn => fn(mesg, data));
	}


	/*******************************************************************************************************************
		Utility Functions.
	*******************************************************************************************************************/
	function _newTrack(sources) {
		return new AudioTrack(sources.map(source => {
			// Handle audio passages.
			if (source.slice(0, 5) !== 'data:' && Story.has(source)) {
				const passage = Story.get(source);

				if (passage.tags.includes('Twine.audio')) {
					return passage.text.trim();
				}
			}

			// Handle URIs—possibly prefixed with a format specifier.
			const match = _formatSpecRe.exec(source);
			return match === null ? source : {
				format : match[1],
				src    : match[2]
			};
		}));
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		// Track Functions.
		tracks : {
			value : Object.freeze(Object.defineProperties({}, {
				add    : { value : trackAdd },
				delete : { value : trackDelete },
				clear  : { value : trackClear },
				has    : { value : trackHas },
				get    : { value : trackGet }
			}))
		},

		// Group Functions.
		groups : {
			value : Object.freeze(Object.defineProperties({}, {
				add    : { value : groupAdd },
				delete : { value : groupDelete },
				clear  : { value : groupClear },
				has    : { value : groupHas },
				get    : { value : groupGet }
			}))
		},

		// Playlist Functions.
		lists : {
			value : Object.freeze(Object.defineProperties({}, {
				add    : { value : listAdd },
				delete : { value : listDelete },
				clear  : { value : listClear },
				has    : { value : listHas },
				get    : { value : listGet }
			}))
		},

		// Runner Functions.
		select : { value : runnerGet },

		// Master Audio Functions.
		load           : { value : masterLoad },
		loadWithScreen : { value : masterLoadWithScreen },
		mute           : { value : masterMute },
		muteOnHidden   : { value : masterMuteOnHidden },
		rate           : { value : masterRate },
		stop           : { value : masterStop },
		unload         : { value : masterUnload },
		volume         : { value : masterVolume }
	}));
})();

/***********************************************************************************************************************

	state.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Config, Diff, Engine, PRNG, Scripting, clone, session, storage, */

var State = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// History moment stack.
	let _history = [];

	// Currently active/played moment.
	let _active = momentCreate();

	// Currently active/played moment index.
	let _activeIndex = -1;

	// Titles of all moments which have expired (i.e. fallen off the bottom of the stack).
	let _expired = [];

	// (optional) Seedable PRNG object.
	let _prng = null;

	// Temporary variables object.
	let _tempVariables = {};

	let _qc = 1;
	let _qchandlers = [];

	/*******************************************************************************************************************
		State Functions.
	*******************************************************************************************************************/
	/*
		Resets the story state.
	*/
	function stateReset() {
		if (DEBUG) { console.log('[State/stateReset()]'); }

		/*
			Delete the active session.
		*/
		session.delete('state');

		/*
			Reset the properties.
		*/
		_history     = [];
		_active      = momentCreate();
		_activeIndex = -1;
		_expired     = [];
		_prng        = _prng === null ? null : new PRNG(_prng.seed);
		_qc          = true;
	}

	/*
		Restores the story state from the active session.
	*/
	function stateRestore(soft) {
		if (DEBUG) { console.log('[State/stateRestore()]'); }

		/*
			Attempt to restore an active session.
		*/
		if (session.has('state') && !soft) {
			/*
				Retrieve the session.
			*/
			const stateObj = session.get('state');

			if (DEBUG) { console.log('\tsession state:', stateObj); }

			if (stateObj == null) { // lazy equality for null
				return false;
			}

			/*
				Restore the session.
			*/
			stateUnmarshal(stateObj);
			return true;
		}

		// perform soft reset from history
		if (soft) {
			const frame = _history[_activeIndex];
			if (!frame) return false;
			momentActivate(frame);
			return true;
		}

		return false;
	}

	function reduceHistorySize(stateObj, targetSize) {
		if (!targetSize) return;
		// pick up which frames to preserve, aiming at preserving the frames both before and after the active one
		const currentIndex = stateObj.index;
		const currentHistoryLength = stateObj.history.length;
		targetSize = Math.min(currentHistoryLength, targetSize);
		const invertedIndex = currentHistoryLength - 1 - currentIndex;
		let startingIndex = 0;
		const radius = Math.floor(targetSize / 2); // how many frames can we cover on both sides from active frame

		if (currentIndex < invertedIndex) { // active index is closer to the beginning of the array [* i * * * *]
			if (radius >= currentIndex) startingIndex = 0; // there's enough space to include the oldest frame [(* i *) * * *]
			else startingIndex = currentIndex - radius; // starting index will extend into the past as much as the radius can allow [* (* i *) * *]
		}
		else { // active index is closer to the end of the array [* * * * i *]
			if (radius >= invertedIndex) startingIndex = currentHistoryLength - targetSize; // enough space to include the newest frame [* * * (* i *)]
			else startingIndex = currentIndex - radius; // [* * (* i *) *]
		}
		stateObj.index -= startingIndex; // correct the index
		stateObj.history.slice(0, startingIndex).forEach(m => stateObj.expired.push(m.title)); // expire removed history
		stateObj.history = stateObj.history.slice(startingIndex, startingIndex + targetSize);

		return stateObj;
	}

	/*
		Returns the current story state marshaled into a serializable object.
	*/
	function stateMarshal(noDelta = false, depth = Config.history.maxSessionStates, useClone = false) {
		if (depth === 0) return null; // don't bother
		/*
			Gather the properties.
		*/
		const stateObj = {
			index   : _activeIndex,
			history : useClone ? clone(_history) : _history
		};

		if (_history.length > depth) reduceHistorySize(stateObj, depth);
		if (!noDelta) {
			stateObj.delta = historyDeltaEncode(stateObj.history);
			delete stateObj.history;
		}

		if (_expired.length > 0) stateObj.expired = [..._expired];
		if (_prng !== null && _prng.hasOwnProperty('seed')) stateObj.seed = _prng.seed;

		return stateObj;
	}

	/*
		Restores the story state from a marshaled story state serialization object.
	*/
	function stateUnmarshal(stateObj, type) {
		if (stateObj == null) throw new Error('state object is null or undefined');

		const hasDelta = Object.hasOwn(stateObj, 'delta');
		const hasHistory = Object.hasOwn(stateObj, 'history');
		if (hasDelta && hasHistory) throw new Error('state object has both compressed and uncompressed history');
		if (hasDelta && stateObj.delta.length === 0 || hasHistory && stateObj.history.length === 0 || !hasDelta && !hasHistory) throw new Error('state object has no history or history is empty');
		if (!stateObj.hasOwnProperty('index')) throw new Error('state object has no index');

		/*
			Restore the properties.
		*/
		_history     = hasHistory ? clone(stateObj.history) : historyDeltaDecode(stateObj.delta);
		_activeIndex = stateObj.index;
		_expired     = stateObj.hasOwnProperty('expired') ? [...stateObj.expired] : [];
		_qc          = stateObj.idx;
		// eslint-disable-next-line
		if (_qc != 1) { _qc = 1; if (_qchandlers.length === 0 || !_qchandlers.every(h => h(_history))) _qc += ''; }

		if (stateObj.hasOwnProperty('seed') && _prng !== null) {
			/*
				We only need to restore the PRNG's seed here as `momentActivate()` will handle
				fully restoring the PRNG to its proper state.
			*/
			_prng.seed = stateObj.seed;
		}

		/*
			Activate the current moment (do this only after all properties have been restored).
		*/
		momentActivate(_activeIndex);
	}

	/*
		Returns the current story state marshaled into a save-compatible serializable object.
	*/
	function stateMarshalForSave(depth = 100, noDelta = true) {
		return stateMarshal(noDelta, depth, true);
	}

	/*
		Restores the story state from a marshaled save-compatible story state serialization object.
	*/
	function stateUnmarshalForSave(stateObj, type) {
		return stateUnmarshal(stateObj, type);
	}

	/*
		Returns the titles of expired moments.
	*/
	function stateExpired() {
		return _expired;
	}

	/*
		Returns the total number of played moments (expired + in-play history moments).
	*/
	function stateTurns() {
		return _expired.length + historyLength();
	}

	/*
		Returns the passage titles of all played moments (expired + in-play history moments).
	*/
	function stateTitles() {
		return _expired.concat(_history.slice(0, historyLength()).map(moment => moment.title));
	}

	/*
		Returns whether a passage with the given title has been played (expired + in-play history moments).
	*/
	function stateHasPlayed(title) {
		if (title == null || title === '') { // lazy equality for null
			return false;
		}

		if (_expired.includes(title)) {
			return true;
		}
		else if (_history.slice(0, historyLength()).some(moment => moment.title === title)) {
			return true;
		}

		return false;
	}

	/**
	 * @returns {object} decoded session state
	 */
	function getSessionState() {
		if (Config.history.maxSessionStates === 0) return;

		const sessionState = session.get('state');
		if (sessionState?.hasOwnProperty('delta')) {
			sessionState.history = State.deltaDecode(sessionState.delta);
			delete sessionState.delta;
		}
		return sessionState;
	}

	/**
	 * Tries saving sessionState into sessionStorage until it fits the quota.
	 * sessionState must have history property.
	 *
	 * @param {object} sessionState decoded session state
	 */
	function setSessionState(sessionState) {
		if (!sessionState || !sessionState.history) throw new Error('setSessionState error: not a valid sessionState object');
		let pass = false;
		let sstates = Config.history.maxSessionStates;
		if (sstates === 0) return pass;

		try {
			// if history is bigger than session states limit, reduce the history to match
			if (sessionState.history.length > sstates) reduceHistorySize(sessionState, sstates);
			if (sstates) session.set('state', sessionState); // don't do session writes if sstates is 0, NaN, undefined, etc.
			pass = true;
		}
		catch (ex) {
			console.log('session.set failed, recovering');
			if (sstates > sessionState.history.length) sstates = sessionState.length;
			while (sstates && !pass) {
				try {
					sstates--;
					reduceHistorySize(sessionState, sstates);
					session.set('state', sessionState);
					pass = true;
				}
				catch (ex) {
					continue;
				}
			}
		}
		return pass;
	}


	/*******************************************************************************************************************
		Moment Functions.
	*******************************************************************************************************************/
	/*
		Returns a new moment object created from the given passage title and variables object.
	*/
	function momentCreate(title, variables) {
		return {
			title     : title == null ? '' : String(title),       // lazy equality for null
			variables : variables == null ? {} : clone(variables) // lazy equality for null
		};
	}

	/*
		Returns the active (present) moment.
	*/
	function momentActive() {
		return _active;
	}

	/*
		Returns the index within the history of the active (present) moment.
	*/
	function momentActiveIndex() {
		return _activeIndex;
	}

	/*
		Returns the title from the active (present) moment.
	*/
	function momentActiveTitle() {
		return _active.title;
	}

	/*
		Returns the variables from the active (present) moment.
	*/
	function momentActiveVariables() {
		return _active.variables;
	}

	/*
		Returns the active (present) moment after setting it to either the given moment object
		or the moment object at the given history index.  Additionally, updates the active session
		and triggers a history update event.
	*/
	function momentActivate(moment) {
		if (moment == null) { // lazy equality for null
			throw new Error('moment activation attempted with null or undefined');
		}

		/*
			Set the active moment.
		*/
		switch (typeof moment) {
		case 'object':
			_active = clone(moment);
			break;

		case 'number':
			if (historyIsEmpty()) {
				throw new Error('moment activation attempted with index on empty history');
			}

			if (moment < 0 || moment >= historySize()) {
				throw new RangeError(`moment activation attempted with out-of-bounds index; need [0, ${historySize() - 1}], got ${moment}`);
			}

			_active = clone(_history[moment]);
			break;

		default:
			throw new TypeError(`moment activation attempted with a "${typeof moment}"; must be an object or valid history stack index`);
		}

		/*
			Restore the seedable PRNG.
		*/
		if (_prng !== null) {
			_prng = new PRNG(_prng.seed, _active.pull);
		}

		/*
			Trigger a global `:historyupdate` event.

			NOTE: We do this here because setting a new active moment is a core component
			of, virtually, all history updates.
		*/
		jQuery.event.trigger(':historyupdate');

		return _active;
	}

	function updateSession() {
		/*
			Update the active session.
			todo: refactor it all and move to using setSessionState?
		*/
		let pass = false;
		let depth = Math.min(Config.history.maxSessionStates, State.history.length);
		while (depth > 0 && !pass) {
			try {
				const state = stateMarshal(false, depth);
				state.idx = State.qc;
				session.set('state', state);
				pass = true;
			}
			catch { // depth is too high to fit sessionStorage
				console.log('session.set error, reducing maxSessionStates');
				depth--;
			}
		}
	}
	// save game state to load it back after f5
	window.addEventListener('beforeunload', updateSession);


	/*******************************************************************************************************************
		History Functions.
	*******************************************************************************************************************/
	/*
		Returns the moment history.
	*/
	function historyGet() {
		return _history;
	}

	/*
		Returns the number of active history moments (past only).
	*/
	function historyLength() {
		return _activeIndex + 1;
	}

	/*
		Returns the total number of history moments (past + future).
	*/
	function historySize() {
		return _history.length;
	}

	/*
		Returns whether the history is empty.
	*/
	function historyIsEmpty() {
		return _history.length === 0;
	}

	/*
		Returns the current (pre-play version of the active) moment within the history.
	*/
	function historyCurrent() {
		return _history.length > 0 ? _history[_activeIndex] : null;
	}

	/*
		Returns the topmost (most recent) moment within the history.
	*/
	function historyTop() {
		return _history.length > 0 ? _history[_history.length - 1] : null;
	}

	/*
		Returns the bottommost (least recent) moment within the history.
	*/
	function historyBottom() {
		return _history.length > 0 ? _history[0] : null;
	}

	/*
		Returns the moment at the given index within the history.
	*/
	function historyIndex(index) {
		if (historyIsEmpty() || index < 0 || index > _activeIndex) {
			return null;
		}

		return _history[index];
	}

	/*
		Returns the moment at the given offset from the active moment within the history.
	*/
	function historyPeek(offset) {
		if (historyIsEmpty()) {
			return null;
		}

		const lengthOffset = 1 + (offset ? Math.abs(offset) : 0);

		if (lengthOffset > historyLength()) {
			return null;
		}

		return _history[historyLength() - lengthOffset];
	}

	/*
		Returns whether a moment with the given title exists within the history.
	*/
	function historyHas(title) {
		if (historyIsEmpty() || title == null || title === '') { // lazy equality for null
			return false;
		}

		for (let i = _activeIndex; i >= 0; --i) {
			if (_history[i].title === title) {
				return true;
			}
		}

		return false;
	}

	/*
		Creates a new moment and pushes it onto the history, discarding future moments if necessary.
	*/
	function historyCreate(title) {
		if (DEBUG) { console.log(`[State/historyCreate(title: "${title}")]`); }

		/*
			TODO: It might be good to have some assertions about the passage title here.
		*/

		/*
			If we're not at the top of the stack, discard the future moments.
		*/
		if (historyLength() < historySize()) {
			if (DEBUG) { console.log(`\tnon-top push; discarding ${historySize() - historyLength()} future moments`); }

			_history.splice(historyLength(), historySize() - historyLength());
		}

		/*
			Push the new moment onto the history stack.
		*/
		_history.push(momentCreate(title, _active.variables));

		if (_prng) {
			const top = historyTop();
			top.pull = _prng.pull;
		}

		/*
			Truncate the history, if necessary, by discarding moments from the bottom.
		*/
		while (historySize() > Config.history.maxStates) {
			if (Config.history.maxExpired === 0) _history.shift();
			else {
				_expired.push(_history.shift().title);
			}
			while (_expired.length > Config.history.maxExpired) _expired.shift();
		}

		/*
			Activate the new top moment.
		*/
		_activeIndex = historySize() - 1;
		momentActivate(_activeIndex);

		return historyLength();
	}

	/*
		Activate the moment at the given index within the history.
	*/
	function historyGoTo(index) {
		if (DEBUG) { console.log(`[State/historyGoTo(index: ${index})]`); }

		if (
			   index == null /* lazy equality for null */
			|| index < 0
			|| index >= historySize()
			|| index === _activeIndex
		) {
			return false;
		}

		_activeIndex = index;
		momentActivate(_activeIndex);

		return true;
	}

	/*
		Activate the moment at the given offset from the active moment within the history.
	*/
	function historyGo(offset) {
		if (DEBUG) { console.log(`[State/historyGo(offset: ${offset})]`); }

		if (offset == null || offset === 0) { // lazy equality for null
			return false;
		}

		return historyGoTo(_activeIndex + offset);
	}

	/*
		Returns the delta encoded form of the given history array.
	*/
	function historyDeltaEncode(historyArr) {
		if (!Array.isArray(historyArr)) {
			return null;
		}

		if (historyArr.length === 0) {
			return [];
		}

		// NOTE: The `clone()` call here is likely unnecessary within the current codebase.
		// const delta = [clone(historyArr[0])];
		const delta = [historyArr[0]];

		for (let i = 1, iend = historyArr.length; i < iend; ++i) {
			delta.push(Diff.diff(historyArr[i - 1], historyArr[i]));
		}

		return delta;
	}

	/*
		Returns a history array from the given delta encoded history array.
	*/
	function historyDeltaDecode(delta) {
		if (!Array.isArray(delta)) {
			return null;
		}

		if (delta.length === 0) {
			return [];
		}

		const historyArr = [clone(delta[0])];

		for (let i = 1, iend = delta.length; i < iend; ++i) {
			historyArr.push(Diff.patch(historyArr[i - 1], delta[i]));
		}

		return historyArr;
	}


	/*******************************************************************************************************************
		PRNG Functions.
	*******************************************************************************************************************/
	function prngInit(seed, useEntropy) {
		if (DEBUG) { console.log(`[State/prngInit(seed: ${seed}, useEntropy: ${useEntropy})]`); }

		if (!historyIsEmpty()) {
			let scriptSection;

			if (TWINE1) { // for Twine 1
				scriptSection = 'a script-tagged passage';
			}
			else { // for Twine 2
				scriptSection = 'the Story JavaScript';
			}

			throw new Error(`State.prng.init must be called during initialization, within either ${scriptSection} or the StoryInit special passage`);
		}

		/* Regenerate the PRNG object, then assign the state to the active moment. */
		_prng = new PRNG(seed);
		_active.pull = _prng.pull;
	}

	function prngIsEnabled() {
		return _prng !== null;
	}

	function prngPull() {
		return _prng ? _prng.pull : NaN;
	}

	function prngSeed() {
		return _prng ? _prng.seed : null;
	}

	function prngPeek(count) {
		return _prng.peek(count);
	}

	function prngStr2Int(string) {
		return _prng.str2int(string);
	}

	function prngTest(count, granularity, advancerng) {
		return _prng.test(count, granularity, advancerng);
	}

	function prngRandom(args) {
		if (DEBUG) { console.log('[State/prngRandom()]'); }

		return _prng ? _prng.random(args) : Math.random();
	}


	/*******************************************************************************************************************
		Temporary Variables Functions.
	*******************************************************************************************************************/
	/*
		Clear the temporary variables.
	*/
	function tempVariablesClear() {
		if (DEBUG) { console.log('[State/tempVariablesClear()]'); }

		_tempVariables = {};

		/* legacy */
		TempVariables = _tempVariables; // eslint-disable-line no-undef
		/* /legacy */
	}

	/*
		Returns the current temporary variables.
	*/
	function tempVariables() {
		return _tempVariables;
	}


	/*******************************************************************************************************************
		Variable Chain Parsing Functions.
	*******************************************************************************************************************/
	/*
		Returns the value of the given story/temporary variable.
	*/
	function variableGet(varExpression) {
		try {
			return Scripting.evalTwineScript(varExpression);
		}
		catch (ex) { /* no-op */ }
	}

	/*
		Sets the value of the given story/temporary variable.
	*/
	function variableSet(varExpression, value) {
		try {
			Scripting.evalTwineScript(`${varExpression} = evalTwineScript$Data$`, null, value);
			return true;
		}
		catch (ex) { /* no-op */ }

		return false;
	}


	/*******************************************************************************************************************
		Story Metadata Functions.
	*******************************************************************************************************************/
	const _METADATA_STORE = 'metadata';

	function metadataClear() {
		storage.delete(_METADATA_STORE);
	}

	function metadataDelete(key) {
		if (typeof key !== 'string') {
			throw new TypeError(`State.metadata.delete key parameter must be a string (received: ${typeof key})`);
		}

		const store = storage.get(_METADATA_STORE);

		if (store && store.hasOwnProperty(key)) {
			if (Object.keys(store).length === 1) {
				storage.delete(_METADATA_STORE);
			}
			else {
				delete store[key];
				storage.set(_METADATA_STORE, store);
			}
		}
	}

	function metadataEntries() {
		const store = storage.get(_METADATA_STORE);
		return store && Object.entries(store);
	}

	function metadataGet(key) {
		if (typeof key !== 'string') {
			throw new TypeError(`State.metadata.get key parameter must be a string (received: ${typeof key})`);
		}

		const store = storage.get(_METADATA_STORE);
		return store && store.hasOwnProperty(key) ? store[key] : undefined;
	}

	function metadataHas(key) {
		if (typeof key !== 'string') {
			throw new TypeError(`State.metadata.has key parameter must be a string (received: ${typeof key})`);
		}

		const store = storage.get(_METADATA_STORE);
		return store && store.hasOwnProperty(key);
	}

	function metadataKeys() {
		const store = storage.get(_METADATA_STORE);
		return store && Object.keys(store);
	}

	function metadataSet(key, value) {
		if (typeof key !== 'string') {
			throw new TypeError(`State.metadata.set key parameter must be a string (received: ${typeof key})`);
		}

		if (typeof value === 'undefined') {
			metadataDelete(key);
		}
		else {
			const store = storage.get(_METADATA_STORE) || {};
			store[key] = value;
			storage.set(_METADATA_STORE, store);
		}
	}

	function metadataSize() {
		const store = storage.get(_METADATA_STORE);
		return store ? Object.keys(store).length : 0;
	}

	/**
	 * alias story and temporary variables to the global namespace
	 */
	Object.defineProperties(window, {
		// often redefined by individual games, needs to be configurable
		/* Story variables property. */
		// eslint-disable-next-line id-length
		V : { get() { return _active.variables; }, configurable : true },
		/* Temporary variables property. */
		T : { get() { return _tempVariables; }, configurable : true }
	});

	function prngPullSet(pull) {
		if (!_prng) return;
		if (Number.isInteger(pull)) return _prng.pull = pull;
		throw new Error(`pullSet: invalid parameter: ${pull}`);
	}
	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			State Functions.
		*/
		reset            : { value : stateReset },
		restore          : { value : stateRestore },
		marshalForSave   : { value : stateMarshalForSave },
		unmarshalForSave : { value : stateUnmarshalForSave },
		expired          : { get : stateExpired },
		turns            : { get : stateTurns },
		passages         : { get : stateTitles },
		hasPlayed        : { value : stateHasPlayed },
		getSessionState  : { value : getSessionState },
		setSessionState  : { value : setSessionState },

		/*
			Moment Functions.
		*/
		active      : { get : momentActive },
		activeIndex : { get : momentActiveIndex },
		passage     : { get : momentActiveTitle },     // shortcut for `State.active.title`
		variables   : { get : momentActiveVariables }, // shortcut for `State.active.variables`

		/*
			History Functions.
		*/
		history     : { get : historyGet },
		length      : { get : historyLength },
		size        : { get : historySize },
		isEmpty     : { value : historyIsEmpty },
		current     : { get : historyCurrent },
		top         : { get : historyTop },
		bottom      : { get : historyBottom },
		index       : { value : historyIndex },
		peek        : { value : historyPeek },
		has         : { value : historyHas },
		create      : { value : historyCreate },
		goTo        : { value : historyGoTo },
		go          : { value : historyGo },
		deltaEncode : { value : historyDeltaEncode },
		deltaDecode : { value : historyDeltaDecode },

		/*
			PRNG Functions.
		*/
		prng : {
			value : Object.freeze(Object.defineProperties({}, {
				init      : { value : prngInit },
				isEnabled : { value : prngIsEnabled },
				pull      : { get : prngPull, set(val) { prngPullSet(val); } },
				seed      : { get : prngSeed },
				str2int   : { value : prngStr2Int },
				test      : { value : prngTest },
				peek      : { value : prngPeek }
			}))
		},
		random : { value : prngRandom },

		/*
			Temporary Variables Functions.
		*/
		clearTemporary : { value : tempVariablesClear },
		temporary      : { get : tempVariables },

		/*
			Variable Chain Parsing Functions.
		*/
		getVar : { value : variableGet },
		setVar : { value : variableSet },

		/*
			Story Metadata Functions.
		*/
		metadata : {
			value : Object.freeze(Object.defineProperties({}, {
				clear   : { value : metadataClear },
				delete  : { value : metadataDelete },
				entries : { value : metadataEntries },
				get     : { value : metadataGet },
				has     : { value : metadataHas },
				keys    : { value : metadataKeys },
				set     : { value : metadataSet },
				size    : { get : metadataSize }
			}))
		},

		/*
			qc stuff
		*/
		qc    : { get() { return _qc;  } },
		qcadd : { value(fn) { if (typeof fn === 'function') _qchandlers.push(fn); } },

		/*
			Legacy Aliases.
		*/
		initPRNG : { value : prngInit },
		restart  : { value : () => Engine.restart() },
		backward : { value : () => Engine.backward() },
		forward  : { value : () => Engine.forward() },
		display  : { value : (...args) => Engine.display(...args) },
		show     : { value : (...args) => Engine.show(...args) },
		play     : { value : (...args) => Engine.play(...args) }
	}));
})();

/***********************************************************************************************************************

	markup/scripting.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Engine, Patterns, State, Story, Util, stringFrom */

var Scripting = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/* eslint-disable no-unused-vars */

	/*******************************************************************************************************************
		Deprecated Legacy Functions.
	*******************************************************************************************************************/
	/*
		[DEPRECATED] Returns the jQuery-wrapped target element(s) after making them accessible
		clickables (ARIA compatibility).

		NOTE: Unused, included only for compatibility.
	*/
	function addAccessibleClickHandler(targets, selector, handler, one, namespace) {
		if (arguments.length < 2) {
			throw new Error('addAccessibleClickHandler insufficient number of parameters');
		}

		let fn;
		let opts;

		if (typeof selector === 'function') {
			fn = selector;
			opts = {
				namespace : one,
				one       : !!handler
			};
		}
		else {
			fn = handler;
			opts = {
				namespace,
				one : !!one,
				selector
			};
		}

		if (typeof fn !== 'function') {
			throw new TypeError('addAccessibleClickHandler handler parameter must be a function');
		}

		return jQuery(targets).ariaClick(opts, fn);
	}

	/*
		[DEPRECATED] Returns a new DOM element, optionally appending it to the passed DOM element, if any.

		NOTE: Unused, included only for compatibility.
	*/
	function insertElement(place, type, id, classNames, text, title) { // eslint-disable-line max-params
		const $el = jQuery(document.createElement(type));

		// Add attributes/properties.
		if (id) {
			$el.attr('id', id);
		}

		if (classNames) {
			$el.addClass(classNames);
		}

		if (title) {
			$el.attr('title', title);
		}

		// Add text content.
		if (text) {
			$el.text(text);
		}

		// Append it to the given node.
		if (place) {
			$el.appendTo(place);
		}

		return $el[0];
	}

	/*
		[DEPRECATED] Creates a new text node and appends it to the passed DOM element.

		NOTE: Unused, included only for compatibility.
	*/
	function insertText(place, text) {
		jQuery(place).append(document.createTextNode(text));
	}

	/*
		[DEPRECATED] Removes all children from the passed DOM node.

		NOTE: Unused, included only for compatibility.
	*/
	function removeChildren(node) {
		jQuery(node).empty();
	}

	/*
		[DEPRECATED] Removes the passed DOM node.

		NOTE: Unused, included only for compatibility.
	*/
	function removeElement(node) {
		jQuery(node).remove();
	}

	/*
		[DEPRECATED] Fades a DOM element in or out.

		NOTE: Unused, included only for compatibility.
	*/
	function fade(el, options) {
		/* eslint-disable no-param-reassign */
		const direction = options.fade === 'in' ? 1 : -1;
		let current;
		let proxy      = el.cloneNode(true);
		let intervalId; // eslint-disable-line prefer-const

		function tick() {
			current += 0.05 * direction;
			setOpacity(proxy, Math.easeInOut(current));

			if (direction === 1 && current >= 1 || direction === -1 && current <= 0) {
				el.style.visibility = options.fade === 'in' ? 'visible' : 'hidden';
				proxy.parentNode.replaceChild(el, proxy);
				proxy = null;
				window.clearInterval(intervalId);

				if (options.onComplete) {
					options.onComplete();
				}
			}
		}

		function setOpacity(el, opacity) {
			// Old IE.
			el.style.zoom = 1;
			el.style.filter = `alpha(opacity=${Math.floor(opacity * 100)})`;

			// CSS.
			el.style.opacity = opacity;
		}

		el.parentNode.replaceChild(proxy, el);

		if (options.fade === 'in') {
			current = 0;
			proxy.style.visibility = 'visible';
		}
		else {
			current = 1;
		}

		setOpacity(proxy, current);
		intervalId = window.setInterval(tick, 25);
		/* eslint-enable no-param-reassign */
	}

	/*
		[DEPRECATED] Scrolls the browser window to ensure that a DOM element is in view.

		NOTE: Unused, included only for compatibility.
	*/
	function scrollWindowTo(el, incrementBy) {
		/* eslint-disable no-param-reassign */
		let increment = incrementBy != null ? Number(incrementBy) : 0.1; // lazy equality for null

		if (Number.isNaN(increment) || !Number.isFinite(increment) || increment < 0) {
			increment = 0.1;
		}
		else if (increment > 1) {
			increment = 1;
		}

		const start     = window.scrollY ? window.scrollY : document.body.scrollTop;
		const end       = ensureVisible(el);
		const distance  = Math.abs(start - end);
		const direction = start > end ? -1 : 1;
		let progress   = 0;
		let intervalId; // eslint-disable-line prefer-const

		function tick() {
			progress += increment;
			window.scroll(0, start + direction * (distance * Math.easeInOut(progress)));

			if (progress >= 1) {
				window.clearInterval(intervalId);
			}
		}

		function findPosY(el) { // eslint-disable-line no-shadow
			let curtop = 0;

			while (el.offsetParent) {
				curtop += el.offsetTop;
				el = el.offsetParent;
			}

			return curtop;
		}

		function ensureVisible(el) { // eslint-disable-line no-shadow
			const posTop    = findPosY(el);
			const posBottom = posTop + el.offsetHeight;
			const winTop    = window.scrollY ? window.scrollY : document.body.scrollTop;
			const winHeight = window.innerHeight ? window.innerHeight : document.body.clientHeight;
			const winBottom = winTop + winHeight;

			return posTop >= winTop && posBottom > winBottom && el.offsetHeight < winHeight
				? posTop - (winHeight - el.offsetHeight) + 20
				: posTop;
		}

		intervalId = window.setInterval(tick, 25);
		/* eslint-enable no-param-reassign */
	}

	/*
		[DEPRECATED] Returns the simple string representation of the passed value or,
		if there is none, the passed default value.

		NOTE: Unused, included only for compatibility.
	*/
	function toStringOrDefault(value /* , defValue */) {
		return stringFrom(value);
	}


	/*******************************************************************************************************************
		User Functions.
	*******************************************************************************************************************/
	/*
		Returns a random value from its given arguments.
	*/
	function either(/* variadic */) {
		if (arguments.length === 0) {
			return;
		}

		return Array.prototype.concat.apply([], arguments).random();
	}

	/*
		Removes the given key, and its value, from the story metadata store.
	*/
	function forget(key) {
		if (typeof key !== 'string') {
			throw new TypeError(`forget key parameter must be a string (received: ${Util.getType(key)})`);
		}

		State.metadata.delete(key);
	}

	/*
		Returns whether a passage with the given title exists within the story
		history.  If multiple passage titles are given, returns the logical-AND
		aggregate of the set.
	*/
	function hasVisited(/* variadic */) {
		if (arguments.length === 0) {
			throw new Error('hasVisited called with insufficient parameters');
		}

		if (State.isEmpty()) {
			return false;
		}

		const needles = Array.prototype.concat.apply([], arguments);
		const played  = State.passages;

		for (let i = 0, iend = needles.length; i < iend; ++i) {
			if (!played.includes(needles[i])) {
				return false;
			}
		}

		return true;
	}

	/*
		Returns the number of turns that have passed since the last instance of the given passage
		occurred within the story history or `-1` if it does not exist.  If multiple passages are
		given, returns the lowest count (which can be `-1`).
	*/
	function lastVisited(/* variadic */) {
		if (arguments.length === 0) {
			throw new Error('lastVisited called with insufficient parameters');
		}

		if (State.isEmpty()) {
			return -1;
		}

		const needles = Array.prototype.concat.apply([], arguments);
		const played  = State.passages;
		const uBound  = played.length - 1;
		let turns = State.turns;

		for (let i = 0, iend = needles.length; i < iend && turns > -1; ++i) {
			const lastIndex = played.lastIndexOf(needles[i]);
			turns = Math.min(turns, lastIndex === -1 ? -1 : uBound - lastIndex);
		}

		return turns;
	}

	/*
		Sets the given key/value pair within the story metadata store.
	*/
	function memorize(key, value) {
		if (typeof key !== 'string') {
			throw new TypeError(`memorize key parameter must be a string (received: ${Util.getType(key)})`);
		}

		State.metadata.set(key, value);
	}

	/*
		Returns the title of the current passage.
	*/
	function passage() {
		return State.passage;
	}

	/*
		Returns the title of a previous passage, either the most recent one whose title does not
		match that of the active passage or the one at the optional offset, or an empty string,
		if there is no such passage.
	*/
	function previous(/* legacy: offset */) {
		const passages = State.passages;

		/* legacy: behavior with an offset */
		if (arguments.length > 0) {
			const offset = Number(arguments[0]);

			if (!Number.isSafeInteger(offset) || offset < 1) {
				throw new RangeError('previous offset parameter must be a positive integer greater than zero');
			}

			return passages.length > offset ? passages[passages.length - 1 - offset] : '';
		}
		/* /legacy */

		for (let i = passages.length - 2; i >= 0; --i) {
			if (passages[i] !== State.passage) {
				return passages[i];
			}
		}

		return '';
	}

	/*
		Returns a pseudo-random whole number (integer) within the range of the given bounds.
	*/
	function random(/* [min ,] max, useMath */) {
		let min = 0;
		let max;
		let useMath = false;

		switch (arguments.length) {
		case 0:
			throw new Error('random called with insufficient parameters');
		case 1:
				max = Math.trunc(arguments[0]);
				break;
		case 2:
			if (arguments[1] === true) {
				max = Math.trunc(arguments[0]);
				useMath = true;
				break;
			}
			// falls-through
		default:
			min = Math.trunc(arguments[0]);
			max = Math.trunc(arguments[1]);
			useMath = arguments[2] == true;
			break;
		}

		if (!Number.isInteger(min)) {
			throw new Error('random min parameter must be an integer');
		}
		if (!Number.isInteger(max)) {
			throw new Error('random max parameter must be an integer');
		}

		if (min > max) {
			[min, max] = [max, min];
		}
		return Math.floor((useMath ? Math.random() : State.random()) * (max - min + 1)) + min;
	}

	/*
		Returns a pseudo-random real number (floating-point) within the range of the given bounds.

		NOTE: Unlike with its sibling function `random()`, the `max` parameter
		is exclusive, not inclusive—i.e. the range goes to, but does not include,
		the given value.
	*/
	function randomFloat(/* [min ,] max, useMath */) {
		let min = 0.0;
		let max;
		let useMath = false;

		switch (arguments.length) {
		case 0:
			throw new Error('randomFloat called with insufficient parameters');
		case 1:
			min = 0.0;
			max = Number(arguments[0]);
			break;
		case 2:
			if (arguments[1] === true) {
				max = Number(arguments[0]);
				useMath = true;
				break;
			}
			// falls-through
		default:
			min = Number(arguments[0]);
			max = Number(arguments[1]);
			useMath = arguments[1] == true;
			break;
		}

		if (Number.isNaN(min) || !Number.isFinite(min)) {
			throw new Error('randomFloat min parameter must be a number');
		}
		if (Number.isNaN(max) || !Number.isFinite(max)) {
			throw new Error('randomFloat max parameter must be a number');
		}

		if (min > max) {
			[min, max] = [max, min];
		}
		return (useMath ? Math.random() : State.random()) * (max - min) + min;
	}

	/*
		Returns the value of the given key from the story metadata store
		or the given default value if the key does not exist.
	*/
	function recall(key, defaultValue) {
		if (typeof key !== 'string') {
			throw new TypeError(`recall key parameter must be a string (received: ${Util.getType(key)})`);
		}

		return State.metadata.has(key) ? State.metadata.get(key) : defaultValue;
	}

	/*
		Returns a new array consisting of all of the tags of the given passages.
	*/
	function tags(/* variadic */) {
		if (arguments.length === 0) {
			return Story.get(State.passage).tags.slice(0);
		}

		const passages = Array.prototype.concat.apply([], arguments);
		let tags = [];

		for (let i = 0, iend = passages.length; i < iend; ++i) {
			tags = tags.concat(Story.get(passages[i]).tags);
		}

		return tags;
	}

	/*
		Returns a reference to the current temporary _variables store.
	*/
	function temporary() {
		return State.temporary;
	}

	/*
		Returns the number of milliseconds which have passed since the current passage was rendered.
	*/
	function time() {
		return Engine.lastPlay === null ? 0 : Util.now() - Engine.lastPlay;
	}

	/*
		Returns the number of passages that the player has visited.

		NOTE: Passages which were visited but have been undone—e.g. via the backward
		button or the `<<back>>` macro—are no longer part of the in-play story
		history and thus are not tallied.  Passages which were visited but have
		expired from the story history, on the other hand, are tallied.
	*/
	function turns() {
		return State.turns;
	}

	/*
		Returns a reference to the current story $variables store.
	*/
	function variables() {
		return State.variables;
	}

	/*
		Returns the number of times that the passage with the given title exists within the story
		history.  If multiple passage titles are given, returns the lowest count.
	*/
	function visited(/* variadic */) {
		if (State.isEmpty()) {
			return 0;
		}

		const needles = Array.prototype.concat.apply([], arguments.length === 0 ? [State.passage] : arguments);
		const played  = State.passages;
		let count = State.turns;

		for (let i = 0, iend = needles.length; i < iend && count > 0; ++i) {
			count = Math.min(count, played.count(needles[i]));
		}

		return count;
	}

	/*
		Returns the number of passages within the story history which are tagged with all of the given tags.
	*/
	function visitedTags(/* variadic */) {
		if (arguments.length === 0) {
			throw new Error('visitedTags called with insufficient parameters');
		}

		if (State.isEmpty()) {
			return 0;
		}

		const needles = Array.prototype.concat.apply([], arguments);
		const nLength = needles.length;
		const played  = State.passages;
		const seen    = new Map();
		let count = 0;

		for (let i = 0, iend = played.length; i < iend; ++i) {
			const title = played[i];

			if (seen.has(title)) {
				if (seen.get(title)) {
					++count;
				}
			}
			else {
				const tags = Story.get(title).tags;

				if (tags.length > 0) {
					let found = 0;

					for (let j = 0; j < nLength; ++j) {
						if (tags.includes(needles[j])) {
							++found;
						}
					}

					if (found === nLength) {
						++count;
						seen.set(title, true);
					}
					else {
						seen.set(title, false);
					}
				}
			}
		}

		return count;
	}

	/* eslint-enable no-unused-vars */


	/*******************************************************************************************************************
		Import Functions.
	*******************************************************************************************************************/
	var { // eslint-disable-line no-var
		/* eslint-disable no-unused-vars */
		importScripts,
		importStyles
		/* eslint-enable no-unused-vars */
	} = (() => {
		// Slugify the given URL.
		function slugifyUrl(url) {
			return Util.parseUrl(url).path
				.replace(/^[^\w]+|[^\w]+$/g, '')
				.replace(/[^\w]+/g, '-')
				.toLocaleLowerCase();
		}

		// Add a <script> element which will load the script from the given URL.
		function addScript(url) {
			return new Promise((resolve, reject) => {
				/*
					WARNING: The ordering of the code within this function is important,
					as some browsers don't play well with different arrangements, so
					be careful when mucking around with it.

					The best supported ordering seems be: events → DOM append → attributes.
				*/
				jQuery(document.createElement('script'))
					.one('load abort error', ev => {
						jQuery(ev.target).off();

						if (ev.type === 'load') {
							resolve(ev.target);
						}
						else {
							reject(new Error(`importScripts failed to load the script "${url}".`));
						}
					})
					.appendTo(document.head)
					.attr({
						id   : `script-imported-${slugifyUrl(url)}`,
						type : 'text/javascript',
						src  : url
					});
			});
		}

		// Add a <link> element which will load the stylesheet from the given URL.
		function addStyle(url) {
			return new Promise((resolve, reject) => {
				/*
					WARNING: The ordering of the code within this function is important,
					as some browsers don't play well with different arrangements, so
					be careful when mucking around with it.

					The best supported ordering seems be: events → DOM append → attributes.
				*/
				jQuery(document.createElement('link'))
					.one('load abort error', ev => {
						jQuery(ev.target).off();

						if (ev.type === 'load') {
							resolve(ev.target);
						}
						else {
							reject(new Error(`importStyles failed to load the stylesheet "${url}".`));
						}
					})
					.appendTo(document.head)
					.attr({
						id   : `style-imported-${slugifyUrl(url)}`,
						rel  : 'stylesheet',
						href : url
					});
			});
		}

		// Turn a list of callbacks into a sequential chain of `Promise` objects.
		function sequence(callbacks) {
			return callbacks.reduce((seq, fn) => seq = seq.then(fn), Promise.resolve()); // eslint-disable-line no-param-reassign
		}

		/*
			Import scripts from a URL.
		*/
		function importScripts(...urls) {
			return Promise.all(urls.map(oneOrSeries => {
				// Array of URLs to be imported in sequence.
				if (Array.isArray(oneOrSeries)) {
					return sequence(oneOrSeries.map(url => () => addScript(url)));
				}

				// Single URL to be imported.
				return addScript(oneOrSeries);
			}));
		}

		/*
			Import stylesheets from a URL.
		*/
		function importStyles(...urls) {
			return Promise.all(urls.map(oneOrSeries => {
				// Array of URLs to be imported in sequence.
				if (Array.isArray(oneOrSeries)) {
					return sequence(oneOrSeries.map(url => () => addStyle(url)));
				}

				// Single URL to be imported.
				return addStyle(oneOrSeries);
			}));
		}

		// Exports.
		return {
			importScripts,
			importStyles
		};
	})();


	/*******************************************************************************************************************
		Parsing Functions.
	*******************************************************************************************************************/
	/*
		Returns the given string after converting all TwineScript syntactical sugars to
		their native JavaScript counterparts.
	*/
	const parse = (() => {
		const tokenTable = Util.toEnum({
			/* eslint-disable quote-props */
			// Story $variable sigil-prefix.
			'$'     : 'State.variables.',
			// Temporary _variable sigil-prefix.
			'_'     : 'State.temporary.',
			// Assignment operators.
			'to'    : '=',
			// Equality operators.
			'eq'    : '==',
			'neq'   : '!=',
			'is'    : '===',
			'isnot' : '!==',
			// Relational operators.
			'gt'    : '>',
			'gte'   : '>=',
			'lt'    : '<',
			'lte'   : '<=',
			// Logical operators.
			'and'   : '&&',
			'or'    : '||',
			// Unary operators.
			'not'   : '!',
			'def'   : '"undefined" !== typeof',
			'ndef'  : '"undefined" === typeof'
			/* eslint-enable quote-props */
		});
		const parseRe = new RegExp([
			'(?:""|\'\'|``)',                                     //   Empty quotes (incl. template literal)
			'(?:"(?:\\\\.|[^"\\\\])+")',                          //   Double quoted, non-empty
			"(?:'(?:\\\\.|[^'\\\\])+')",                          //   Single quoted, non-empty
			'(`(?:\\\\.|[^`\\\\])+`)',                            // 1=Template literal, non-empty
			'(?:[=+\\-*\\/%<>&\\|\\^~!?:,;\\(\\)\\[\\]{}]+)',     //   Operator delimiters
			'([^"\'=+\\-*\\/%<>&\\|\\^~!?:,;\\(\\)\\[\\]{}\\s]+)' // 2=Barewords
		].join('|'), 'g');
		const notSpaceRe      = /\S/;
		const varTest         = new RegExp(`^${Patterns.variable}`);
		const withColonTestRe = /^\s*:/;
		const withNotTestRe   = /^\s+not\b/;

		function parse(rawCodeString) {
			if (parseRe.lastIndex !== 0) {
				throw new RangeError('Scripting.parse last index is non-zero at start');
			}

			let code  = rawCodeString;
			let match;

			while ((match = parseRe.exec(code)) !== null) {
				// no-op: Empty quotes | Double quoted | Single quoted | Operator delimiters

				// Template literal, non-empty.
				if (match[1]) {
					const rawTemplate = match[1];
					const parsedTemplate = parseTemplate(rawTemplate);

					if (parsedTemplate !== rawTemplate) {
						code = code.splice(
							match.index,        // starting index
							rawTemplate.length, // replace how many
							parsedTemplate      // replacement string
						);
						parseRe.lastIndex += parsedTemplate.length - rawTemplate.length;
					}
				}

				// Barewords.
				else if (match[2]) {
					let token = match[2];

					// If the token is simply a dollar-sign or underscore, then it's either
					// just the raw character or, probably, a function alias, so skip it.
					if (token === '$' || token === '_') {
						continue;
					}

					// If the token is a story $variable or temporary _variable, reset it
					// to just its sigil—for later mapping.
					else if (varTest.test(token)) {
						token = token[0];
					}

					// If the token is `is`, check to see if it's followed by `not`, if so,
					// convert them into the `isnot` operator.
					//
					// NOTE: This is a safety feature, since `$a is not $b` probably sounds
					// reasonable to most users.
					else if (token === 'is') {
						const start = parseRe.lastIndex;
						const ahead = code.slice(start);

						if (withNotTestRe.test(ahead)) {
							code = code.splice(start, ahead.search(notSpaceRe));
							token = 'isnot';
						}
					}

					// If the token is followed by a colon, then it's likely to be an object
					// property, so skip it.
					else {
						const ahead = code.slice(parseRe.lastIndex);

						if (withColonTestRe.test(ahead)) {
							continue;
						}
					}

					// If the finalized token has a mapping, replace it within the code string
					// with its counterpart.
					if (tokenTable[token]) {
						code = code.splice(
							match.index,      // starting index
							token.length,     // replace how many
							tokenTable[token] // replacement string
						);
						parseRe.lastIndex += tokenTable[token].length - token.length;
					}
				}
			}

			return code;
		}

		const templateGroupStartRe = /\$\{/g;
		const templateGroupParseRe = new RegExp([
			'(?:""|\'\')',               //   Empty quotes
			'(?:"(?:\\\\.|[^"\\\\])+")', //   Double quoted, non-empty
			"(?:'(?:\\\\.|[^'\\\\])+')", //   Single quoted, non-empty
			'(\\{)',                     // 1=Opening curly brace
			'(\\})'                      // 2=Closing curly brace
		].join('|'), 'g');

		function parseTemplate(rawTemplateLiteral) {
			if (templateGroupStartRe.lastIndex !== 0) {
				throw new RangeError('Scripting.parse last index is non-zero at start of template literal');
			}

			let template   = rawTemplateLiteral;
			let startMatch;

			while ((startMatch = templateGroupStartRe.exec(template)) !== null) {
				const startIdx = startMatch.index + 2;
				let endIdx   = startIdx;
				let depth    = 1;
				let endMatch;

				templateGroupParseRe.lastIndex = startIdx;

				while ((endMatch = templateGroupParseRe.exec(template)) !== null) {
					// Opening curly brace.
					if (endMatch[1]) {
						++depth;
					}
					// Closing curly brace.
					else if (endMatch[2]) {
						--depth;
					}

					if (depth === 0) {
						endIdx = endMatch.index;
						break;
					}
				}

				// If the group is not empty, replace it within the template
				// with its parsed counterpart.
				if (endIdx > startIdx) {
					const parseIndex = parseRe.lastIndex;
					const rawGroup   = template.slice(startIdx, endIdx);

					parseRe.lastIndex = 0;
					const parsedGroup = parse(rawGroup);
					parseRe.lastIndex = parseIndex;

					template = template.splice(
						startIdx,        // starting index
						rawGroup.length, // replace how many
						parsedGroup      // replacement string
					);
					templateGroupStartRe.lastIndex += parsedGroup.length - rawGroup.length;
				}
			}

			return template;
		}

		return parse;
	})();


	/*******************************************************************************************************************
		Eval Functions.
	*******************************************************************************************************************/
	/* eslint-disable no-eval, no-extra-parens, no-unused-vars */
	/*
		Evaluates the given JavaScript code and returns the result, throwing if there were errors.
	*/
	function evalJavaScript(code, output, data) {
		return (function (code, output, evalJavaScript$Data$) {
			return eval(code);
		}).call(output ? { output } : null, String(code), output, data);
	}

	/*
		Evaluates the given TwineScript code and returns the result, throwing if there were errors.
	*/
	function evalTwineScript(code, output, data) {
		// NOTE: Do not move the dollar sign to the front of `evalTwineScript$Data$`,
		// as `parse()` will break references to it within the code string.
		return (function (code, output, evalTwineScript$Data$) {
			return eval(code);
		}).call(output ? { output } : null, parse(String(code)), output, data);
	}
	/* eslint-enable no-eval, no-extra-parens, no-unused-vars */


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		parse           : { value : parse },
		evalJavaScript  : { value : evalJavaScript },
		evalTwineScript : { value : evalTwineScript }
	}));
})();

/***********************************************************************************************************************

	markup/lexer.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

var { // eslint-disable-line no-var
	/* eslint-disable no-unused-vars */
	EOF,
	Lexer
	/* eslint-enable no-unused-vars */
} = (() => {
	'use strict';

	// End of file (string, actually).
	const EOF = -1;


	/*******************************************************************************************************************
		Lexer Class.
	*******************************************************************************************************************/
	class Lexer {
		constructor(source, initialState) {
			if (arguments.length < 2) {
				throw new Error('Lexer constructor called with too few parameters (source:string , initialState:function)');
			}

			/*
				this.source  → the string to be scanned
				this.initial → initial state
				this.state   → current state
				this.start   → start position of an item
				this.pos     → current position in the source string
				this.depth   → current brace/bracket/parenthesis nesting depth
				this.items   → scanned item queue
				this.data    → lexing data
			*/
			Object.defineProperties(this, {
				source : {
					value : source
				},

				initial : {
					value : initialState
				},

				state : {
					writable : true,
					value    : initialState
				},

				start : {
					writable : true,
					value    : 0
				},

				pos : {
					writable : true,
					value    : 0
				},

				depth : {
					writable : true,
					value    : 0
				},

				items : {
					writable : true,
					value    : []
				},

				data : {
					writable : true,
					value    : {}
				}
			});
		}

		reset() {
			this.state  = this.initial;
			this.start  = 0;
			this.pos    = 0;
			this.depth  = 0;
			this.items  = [];
			this.data   = {};
		}

		run() {
			// scan the source string until no states remain
			while (this.state !== null) {
				this.state = this.state(this);
			}

			// return the array of items
			return this.items;
		}

		nextItem() {
			// scan the source string until we have an item or no states remain
			while (this.items.length === 0 && this.state !== null) {
				this.state = this.state(this);
			}

			// return the current item
			return this.items.shift();
		}

		next() {
			if (this.pos >= this.source.length) {
				return EOF;
			}

			return this.source[this.pos++];
		}

		peek() {
			if (this.pos >= this.source.length) {
				return EOF;
			}

			return this.source[this.pos];
		}

		backup(num) {
			// if (num) {
			// 	this.pos -= num;
			// }
			// else {
			// 	--this.pos;
			// }
			this.pos -= num || 1;
		}

		forward(num) {
			// if (num) {
			// 	this.pos += num;
			// }
			// else {
			// 	++this.pos;
			// }
			this.pos += num || 1;
		}

		ignore() {
			this.start = this.pos;
		}

		accept(valid) {
			const ch = this.next();

			if (ch === EOF) {
				return false;
			}

			if (valid.includes(ch)) {
				return true;
			}

			this.backup();
			return false;
		}

		acceptRe(validRe) {
			const ch = this.next();

			if (ch === EOF) {
				return false;
			}

			if (validRe.test(ch)) {
				return true;
			}

			this.backup();
			return false;
		}

		acceptRun(valid) {
			for (;;) {
				const ch = this.next();

				if (ch === EOF) {
					return;
				}

				if (!valid.includes(ch)) {
					break;
				}
			}

			this.backup();
		}

		acceptRunRe(validRe) {
			for (;;) {
				const ch = this.next();

				if (ch === EOF) {
					return;
				}

				if (!validRe.test(ch)) {
					break;
				}
			}

			this.backup();
		}

		emit(type) {
			this.items.push({
				type,
				text  : this.source.slice(this.start, this.pos),
				start : this.start,
				pos   : this.pos
			});
			this.start = this.pos;
		}

		error(type, message) {
			if (arguments.length < 2) {
				throw new Error('Lexer.prototype.error called with too few parameters (type:number , message:string)');
			}

			this.items.push({
				type,
				message,
				text  : this.source.slice(this.start, this.pos),
				start : this.start,
				pos   : this.pos
			});
			return null;
		}

		static enumFromNames(names) {
			const obj = names.reduce((obj, name, i) => {
				obj[name] = i; // eslint-disable-line no-param-reassign
				return obj;
			}, {});
			return Object.freeze(Object.assign(Object.create(null), obj));
		}
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return {
		EOF,
		Lexer
	};
})();

/***********************************************************************************************************************

	markup/wikifier.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/*
	global Config, EOF, Engine, Lexer, Patterns, Scripting, State, Story, TempState, Util, convertBreaks,
	       errorPrologRegExp
*/

/*
	TODO: The Wikifier, and associated code, could stand to receive a serious refactoring.
*/
/* eslint-disable max-len */
var Wikifier = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Wikifier call depth.
	let _callDepth = 0;


	/*******************************************************************************************************************
		Wikifier Class.
	*******************************************************************************************************************/
	class Wikifier {
		constructor(destination, source, options) {
			if (Wikifier.Parser.Profile.isEmpty()) {
				Wikifier.Parser.Profile.compile();
			}

			Object.defineProperties(this, {
				// General Wikifier properties.
				source : {
					value : String(source)
				},

				options : {
					writable : true,
					value    : Object.assign({
						profile : 'all'
					}, options)
				},

				nextMatch : {
					writable : true,
					value    : 0
				},

				output : {
					writable : true,
					value    : null
				},

				// Macro parser ('macro') related properties.
				_rawArgs : {
					writable : true,
					value    : ''
				}
			});

			// No destination specified.  Create a fragment to act as the output buffer.
			if (destination == null) { // lazy equality for null
				this.output = document.createDocumentFragment();
			}

			// jQuery-wrapped destination.  Grab the first element.
			else if (destination.jquery) { // cannot use `hasOwnProperty()` here as `jquery` is from jQuery's prototype
				this.output = destination[0];
			}

			// Normal destination.
			else {
				this.output = destination;
			}

			/*
				Wikify the source into the output buffer element, possibly converting line
				breaks into paragraphs.

				NOTE: There's no catch clause here because this try/finally exists solely
				to ensure that the call depth is properly restored in the event that an
				uncaught exception is thrown during the call to `subWikify()`.
			*/
			try {
				++_callDepth;

				this.subWikify(this.output);

				// Limit line break conversion to non-recursive calls.
				if (_callDepth === 1 && Config.cleanupWikifierOutput) {
					convertBreaks(this.output);
				}
			}
			finally {
				--_callDepth;
			}
		}

		subWikify(output, terminator, options) {
			// Placed at top to prevent any execution
			if (Wikifier.stopWikify) return;

			// Cache and temporarily replace the current output buffer.
			const oldOutput = this.output;
			this.output = output;

			let newOptions;
			let oldOptions;

			// Parser option overrides.
			if (Wikifier.Option.length > 0) {
				newOptions = Object.assign(newOptions || {}, Wikifier.Option.options);
			}
			// Local parameter option overrides.
			if (options !== null && typeof options === 'object') {
				newOptions = Object.assign(newOptions || {}, options);
			}
			// If new options exist, cache and temporarily replace the current options.
			if (newOptions) {
				oldOptions = this.options;
				this.options = Object.assign({}, this.options, newOptions);
			}

			const parsersProfile   = Wikifier.Parser.Profile.get(this.options.profile);
			const terminatorRegExp = terminator
				? new RegExp(`(?:${terminator})`, this.options.ignoreTerminatorCase ? 'gim' : 'gm')
				: null;
			let terminatorMatch;
			let parserMatch;

			do {
				// Prepare the RegExp match positions.
				parsersProfile.parserRegExp.lastIndex = this.nextMatch;

				if (terminatorRegExp) {
					terminatorRegExp.lastIndex = this.nextMatch;
				}

				// Get the first matches.
				parserMatch     = parsersProfile.parserRegExp.exec(this.source);
				terminatorMatch = terminatorRegExp ? terminatorRegExp.exec(this.source) : null;

				// Try for a terminator match, unless there's a closer parser match.
				if (terminatorMatch && (!parserMatch || terminatorMatch.index <= parserMatch.index)) {
					// Output any text before the match.
					if (terminatorMatch.index > this.nextMatch) {
						this.outputText(this.output, this.nextMatch, terminatorMatch.index);
					}

					// Set the match parameters.
					this.matchStart  = terminatorMatch.index;
					this.matchLength = terminatorMatch[0].length;
					this.matchText   = terminatorMatch[0];
					this.nextMatch   = terminatorRegExp.lastIndex;

					// Restore the original output buffer and options.
					this.output = oldOutput;

					if (oldOptions) {
						this.options = oldOptions;
					}

					// Exit.
					return;
				}

				// Try for a parser match.
				else if (parserMatch) {
					// Output any text before the match.
					if (parserMatch.index > this.nextMatch) {
						this.outputText(this.output, this.nextMatch, parserMatch.index);
					}

					// Set the match parameters.
					this.matchStart  = parserMatch.index;
					this.matchLength = parserMatch[0].length;
					this.matchText   = parserMatch[0];
					this.nextMatch   = parsersProfile.parserRegExp.lastIndex;

					// Figure out which parser matched.
					let matchingParser;

					for (let i = 1, iend = parserMatch.length; i < iend; ++i) {
						if (parserMatch[i]) {
							matchingParser = i - 1;
							break; // stop once we've found the matching parser
						}
					}

					// Call the parser.
					parsersProfile.parsers[matchingParser].handler(this);

					if (Wikifier.stopWikify) {
						return;
					}

					if (TempState.break != null) { // lazy equality for null
						break;
					}
				}
			} while (terminatorMatch || parserMatch);

			// Output any text after the last match.
			if (TempState.break == null) { // lazy equality for null
				if (this.nextMatch < this.source.length) {
					this.outputText(this.output, this.nextMatch, this.source.length);
					this.nextMatch = this.source.length;
				}
			}

			// In case of <<break>>/<<continue>>, remove the last <br>.
			else if (
				   this.output.lastChild
				&& this.output.lastChild.nodeType === Node.ELEMENT_NODE
				&& this.output.lastChild.nodeName.toUpperCase() === 'BR'
			) {
				jQuery(this.output.lastChild).remove();
			}

			// Restore the original output buffer and options.
			this.output = oldOutput;

			if (oldOptions) {
				this.options = oldOptions;
			}
		}

		outputText(destination, startPos, endPos) {
			destination.appendChild(document.createTextNode(this.source.substring(startPos, endPos)));
		}

		/*
			[DEPRECATED] Meant to be called by legacy macros, this returns the raw, unprocessed
			text given to the currently executing macro.
		*/
		rawArgs() {
			return this._rawArgs;
		}

		/*
			[DEPRECATED] Meant to be called by legacy macros, this returns the text given to
			the currently executing macro after doing TwineScript-to-JavaScript transformations.
		*/
		fullArgs() {
			return Scripting.parse(this._rawArgs);
		}

		/*
			Returns the output generated by wikifying the given text, throwing if there were errors.
		*/
		static wikifyEval(text) {
			const output = document.createDocumentFragment();

			new Wikifier(output, text);

			const errors = output.querySelector('.error');

			if (errors !== null) {
				throw new Error(errors.textContent.replace(errorPrologRegExp, ''));
			}

			return output;
		}

		/*
			Create and return an internal link.
		*/
		static createInternalLink(destination, passage, text, callback) {
			const $link = jQuery(document.createElement('a'));

			if (passage != null) { // lazy equality for null
				$link.attr('data-passage', passage);

				if (Story.has(passage)) {
					$link.addClass('link-internal');

					if (Config.addVisitedLinkClass && State.hasPlayed(passage)) {
						$link.addClass('link-visited');
					}
				}
				else {
					$link.addClass('link-broken');
				}

				$link.ariaClick({ one : true }, () => {
					if (typeof callback === 'function') {
						callback();
					}

					Engine.play(passage);
				});
			}

			if (text) {
				$link.append(document.createTextNode(text));
			}

			if (destination) {
				$link.appendTo(destination);
			}

			// For legacy-compatibility we must return the DOM node.
			return $link[0];
		}

		/*
			Create and return an external link.
		*/
		static createExternalLink(destination, url, text) {
			const $link = jQuery(document.createElement('a'))
				.attr('target', '_blank')
				.addClass('link-external')
				.text(text)
				.appendTo(destination);

			if (url != null) { // lazy equality for null
				$link.attr({
					href     : url,
					tabindex : 0 // for accessiblity
				});
			}

			// For legacy-compatibility we must return the DOM node.
			return $link[0];
		}

		/*
			Returns whether the given link source is external (probably).
		*/
		static isExternalLink(link) {
			if (Story.has(link)) {
				return false;
			}

			const urlRegExp = new RegExp(`^${Patterns.url}`, 'gim');
			return urlRegExp.test(link) || /[/.?#]/.test(link);
		}
	}


	/*******************************************************************************************************************
		Option Static Object.
	*******************************************************************************************************************/
	Object.defineProperty(Wikifier, 'Option', {
		value : (() => {
			// Options array (stack).
			let _optionsStack = [];


			/*
				GlobalOption Functions.
			*/
			function optionLength() {
				return _optionsStack.length;
			}

			function optionGetter() {
				return Object.assign({}, ..._optionsStack);
			}

			function optionClear() {
				_optionsStack = [];
			}

			function optionGet(idx) {
				return _optionsStack[idx];
			}

			function optionPop() {
				return _optionsStack.pop();
			}

			function optionPush(options) {
				if (typeof options !== 'object' || options === null) {
					throw new TypeError(`Wikifier.Option.push options parameter must be an object (received: ${Util.getType(options)})`);
				}

				return _optionsStack.push(options);
			}


			/*
				Exports.
			*/
			return Object.freeze(Object.defineProperties({}, {
				length  : { get : optionLength },
				options : { get : optionGetter },
				clear   : { value : optionClear },
				get     : { value : optionGet },
				pop     : { value : optionPop },
				push    : { value : optionPush }
			}));
		})()
	});


	/*******************************************************************************************************************
		Parser Static Object.
	*******************************************************************************************************************/
	Object.defineProperty(Wikifier, 'Parser', {
		value : (() => {
			// Parser definition array.  Ordering matters, so this must be an ordered list.
			const _parsers = [];

			// Parser profiles object.
			let _profiles;


			/*
				Parser Functions.
			*/
			function parsersGetter() {
				return _parsers;
			}

			function parsersAdd(parser) {
				// Parser object sanity checks.
				if (typeof parser !== 'object') {
					throw new Error('Wikifier.Parser.add parser parameter must be an object');
				}

				if (!parser.hasOwnProperty('name')) {
					throw new Error('parser object missing required "name" property');
				}
				else if (typeof parser.name !== 'string') {
					throw new Error('parser object "name" property must be a string');
				}

				if (!parser.hasOwnProperty('match')) {
					throw new Error('parser object missing required "match" property');
				}
				else if (typeof parser.match !== 'string') {
					throw new Error('parser object "match" property must be a string');
				}

				if (!parser.hasOwnProperty('handler')) {
					throw new Error('parser object missing required "handler" property');
				}
				else if (typeof parser.handler !== 'function') {
					throw new Error('parser object "handler" property must be a function');
				}

				if (parser.hasOwnProperty('profiles') && !Array.isArray(parser.profiles)) {
					throw new Error('parser object "profiles" property must be an array');
				}

				// Check for an existing parser with the same name.
				if (parsersHas(parser.name)) {
					throw new Error(`cannot clobber existing parser "${parser.name}"`);
				}

				// Add the parser to the end of the array.
				_parsers.push(parser);
			}

			function parsersDelete(name) {
				const parser = _parsers.find(parser => parser.name === name);

				if (parser) {
					_parsers.delete(parser);
				}
			}

			function parsersIsEmpty() {
				return _parsers.length === 0;
			}

			function parsersHas(name) {
				return !!_parsers.find(parser => parser.name === name);
			}

			function parsersGet(name) {
				return _parsers.find(parser => parser.name === name) || null;
			}


			/*
				Parser Profile Functions.
			*/
			function profilesGetter() {
				return _profiles;
			}

			function profilesCompile() {
				if (DEBUG) { console.log('[Wikifier.Parser/profilesCompile()]'); }

				const all  = _parsers;
				const core = all.filter(parser => !Array.isArray(parser.profiles) || parser.profiles.includes('core'));

				_profiles = Object.freeze({
					all : {
						parsers      : all,
						parserRegExp : new RegExp(all.map(parser => `(${parser.match})`).join('|'), 'gm')
					},
					core : {
						parsers      : core,
						parserRegExp : new RegExp(core.map(parser => `(${parser.match})`).join('|'), 'gm')
					}
				});

				return _profiles;
			}

			function profilesIsEmpty() {
				return typeof _profiles !== 'object' || Object.keys(_profiles).length === 0;
			}

			function profilesGet(profile) {
				if (typeof _profiles !== 'object' || !_profiles.hasOwnProperty(profile)) {
					throw new Error(`nonexistent parser profile "${profile}"`);
				}

				return _profiles[profile];
			}

			function profilesHas(profile) {
				return typeof _profiles === 'object' && _profiles.hasOwnProperty(profile);
			}


			/*
				Exports.
			*/
			return Object.freeze(Object.defineProperties({}, {
				/*
					Parser Containers.
				*/
				parsers : { get : parsersGetter },

				/*
					Parser Functions.
				*/
				add     : { value : parsersAdd },
				delete  : { value : parsersDelete },
				isEmpty : { value : parsersIsEmpty },
				has     : { value : parsersHas },
				get     : { value : parsersGet },

				/*
					Parser Profile.
				*/
				Profile : {
					value : Object.freeze(Object.defineProperties({}, {
						/*
							Profiles Containers.
						*/
						profiles : { get : profilesGetter },

						/*
							Profiles Functions.
						*/
						compile : { value : profilesCompile },
						isEmpty : { value : profilesIsEmpty },
						has     : { value : profilesHas },
						get     : { value : profilesGet }
					}))
				}
			}));
		})()
	});


	/*******************************************************************************************************************
		Additional Static Properties.
	*******************************************************************************************************************/
	Object.defineProperties(Wikifier, {
		helpers        : { value : {} },
		/* Global exit flag */
		stopWikify     : { value : false, writable : true },
		/*
			Legacy Aliases.
		*/
		getValue       : { value : State.getVar },              // SEE: `state.js`.
		setValue       : { value : State.setVar },              // SEE: `state.js`.
		parse          : { value : Scripting.parse },           // SEE: `markup/scripting.js`.
		evalExpression : { value : Scripting.evalTwineScript }, // SEE: `markup/scripting.js`.
		evalStatements : { value : Scripting.evalTwineScript }, // SEE: `markup/scripting.js`.
		textPrimitives : { value : Patterns }                   // SEE: `lib/patterns.js`.
	});


	/*******************************************************************************************************************
		Helper Static Methods.
	*******************************************************************************************************************/
	Object.defineProperties(Wikifier.helpers, {
		inlineCss : {
			value : (() => {
				const lookaheadRe = new RegExp(Patterns.inlineCss, 'gm');
				const idOrClassRe = new RegExp(`(${Patterns.cssIdOrClassSigil})(${Patterns.anyLetter}+)`, 'g');

				function helperInlineCss(w) {
					const css = { classes : [], id : '', styles : {} };
					let matched;

					do {
						lookaheadRe.lastIndex = w.nextMatch;

						const match = lookaheadRe.exec(w.source);

						matched = match && match.index === w.nextMatch;

						if (matched) {
							if (match[1]) {
								css.styles[Util.fromCssProperty(match[1])] = match[2].trim();
							}
							else if (match[3]) {
								css.styles[Util.fromCssProperty(match[3])] = match[4].trim();
							}
							else if (match[5]) {
								let subMatch;

								idOrClassRe.lastIndex = 0; // NOTE: Guard against buggy implementations.

								while ((subMatch = idOrClassRe.exec(match[5])) !== null) {
									if (subMatch[1] === '.') {
										css.classes.push(subMatch[2]);
									}
									else {
										css.id = subMatch[2];
									}
								}
							}

							w.nextMatch = lookaheadRe.lastIndex; // eslint-disable-line no-param-reassign
						}
					} while (matched);

					return css;
				}

				return helperInlineCss;
			})()
		},

		evalText : {
			value(text) {
				let result;

				try {
					result = Scripting.evalTwineScript(text);

					/*
						Attempt to prevent the leakage of auto-globals by enforcing that
						the resultant value be either a string or a number.

						NOTE: This is not a foolproof solution to the problem of auto-global
						leakage.  Various auto-globals, which return strings or numbers, can
						still leak through—e.g. `window.status` → string.
					*/
					switch (typeof result) {
					case 'string':
						if (result.trim() === '') {
							result = text;
						}
						break;
					case 'number':
						result = String(result);
						break;
					default:
						result = text;
						break;
					}
				}
				catch (ex) {
					result = text;
				}

				return result;
			}
		},

		evalPassageId : {
			value(passage) {
				if (passage == null || Story.has(passage)) { // lazy equality for null; `0` is a valid name, so we cannot simply evaluate `passage`
					return passage;
				}

				return Wikifier.helpers.evalText(passage);
			}
		},

		hasBlockContext : {
			value(nodes) {
				const hasGCS = typeof window.getComputedStyle === 'function';

				for (let i = nodes.length - 1; i >= 0; --i) {
					const node = nodes[i];

					switch (node.nodeType) {
					case Node.ELEMENT_NODE:
						{
							const tagName = node.nodeName.toUpperCase();

							if (tagName === 'BR') {
								return true;
							}

							const styles = hasGCS ? window.getComputedStyle(node, null) : node.currentStyle;

							if (styles && styles.display) {
								if (styles.display === 'none') {
									continue;
								}

								return styles.display === 'block';
							}

							/*
								WebKit/Blink-based browsers do not attach any computed style
								information to elements until they're inserted into the DOM
								(and probably visible), not even the default browser styles
								and any user styles.  So, we make an assumption based on the
								element.
							*/
							switch (tagName) {
							case 'ADDRESS':
							case 'ARTICLE':
							case 'ASIDE':
							case 'BLOCKQUOTE':
							case 'CENTER':
							case 'DIV':
							case 'DL':
							case 'FIGURE':
							case 'FOOTER':
							case 'FORM':
							case 'H1':
							case 'H2':
							case 'H3':
							case 'H4':
							case 'H5':
							case 'H6':
							case 'HEADER':
							case 'HR':
							case 'MAIN':
							case 'NAV':
							case 'OL':
							case 'P':
							case 'PRE':
							case 'SECTION':
							case 'TABLE':
							case 'UL':
								return true;
							}
						}

						return false;

					case Node.COMMENT_NODE:
						continue;

					default:
						return false;
					}
				}

				return true;
			}
		},

		createShadowSetterCallback : {
			value : (() => {
				let macroParser = null;

				function cacheMacroParser() {
					if (!macroParser) {
						macroParser = Wikifier.Parser.get('macro');

						if (!macroParser) {
							throw new Error('cannot find "macro" parser');
						}
					}

					return macroParser;
				}

				function getMacroContextShadowView() {
					const macro = macroParser || cacheMacroParser();
					const view  = new Set();

					for (let context = macro.context; context !== null; context = context.parent) {
						if (context._shadows) {
							context._shadows.forEach(name => view.add(name));
						}
					}

					return [...view];
				}

				function helperCreateShadowSetterCallback(code) {
					const shadowStore = {};

					getMacroContextShadowView().forEach(varName => {
						const varKey = varName.slice(1);
						const store  = varName[0] === '$' ? State.variables : State.temporary;
						shadowStore[varName] = store[varKey];
					});

					return function () {
						const shadowNames = Object.keys(shadowStore);
						const valueCache  = shadowNames.length > 0 ? {} : null;

						/*
							There's no catch clause because this try/finally is here simply to ensure that
							proper cleanup is done in the event that an exception is thrown during the
							evaluation.
						*/
						try {
							/*
								Cache the existing values of the variables to be shadowed and assign the
								shadow values.
							*/
							shadowNames.forEach(varName => {
								const varKey = varName.slice(1);
								const store  = varName[0] === '$' ? State.variables : State.temporary;

								if (store.hasOwnProperty(varKey)) {
									valueCache[varKey] = store[varKey];
								}

								store[varKey] = shadowStore[varName];
							});

							// Evaluate the JavaScript.
							return Scripting.evalJavaScript(code);
						}
						finally {
							// Revert the variable shadowing.
							shadowNames.forEach(varName => {
								const varKey = varName.slice(1);
								const store  = varName[0] === '$' ? State.variables : State.temporary;

								/*
									Update the shadow store with the variable's current value, in case it
									was modified during the callback.
								*/
								shadowStore[varName] = store[varKey];

								if (valueCache.hasOwnProperty(varKey)) {
									store[varKey] = valueCache[varKey];
								}
								else {
									delete store[varKey];
								}
							});
						}
					};
				}

				return helperCreateShadowSetterCallback;
			})()
		},

		parseSquareBracketedMarkup : {
			value : (() => {
				/* eslint-disable no-param-reassign */
				const Item = Lexer.enumFromNames([ // lex item types object (pseudo-enumeration)
					'Error',     // error
					'DelimLTR',  // '|' or '->'
					'DelimRTL',  // '<-'
					'InnerMeta', // ']['
					'ImageMeta', // '[img[', '[<img[', or '[>img['
					'LinkMeta',  // '[['
					'Link',      // link destination
					'RightMeta', // ']]'
					'Setter',    // setter expression
					'Source',    // image source
					'Text'       // link text or image alt text
				]);
				const Delim = Lexer.enumFromNames([ // delimiter state object (pseudo-enumeration)
					'None', // no delimiter encountered
					'LTR',  // '|' or '->'
					'RTL'   // '<-'
				]);

				// Lexing functions.
				function slurpQuote(lexer, endQuote) {
					loop: for (;;) {
						/* eslint-disable indent */
						switch (lexer.next()) {
						case '\\':
							{
								const ch = lexer.next();

								if (ch !== EOF && ch !== '\n') {
									break;
								}
							}
							/* falls through */
						case EOF:
						case '\n':
							return EOF;

						case endQuote:
							break loop;
						}
						/* eslint-enable indent */
					}

					return lexer.pos;
				}

				function lexLeftMeta(lexer) {
					if (!lexer.accept('[')) {
						return lexer.error(Item.Error, 'malformed square-bracketed markup');
					}

					// Is link markup.
					if (lexer.accept('[')) {
						lexer.data.isLink = true;
						lexer.emit(Item.LinkMeta);
					}

					// May be image markup.
					else {
						lexer.accept('<>'); // aligner syntax

						if (!lexer.accept('Ii') || !lexer.accept('Mm') || !lexer.accept('Gg') || !lexer.accept('[')) {
							return lexer.error(Item.Error, 'malformed square-bracketed markup');
						}

						lexer.data.isLink = false;
						lexer.emit(Item.ImageMeta);
					}

					lexer.depth = 2; // account for both initial left square brackets
					return lexCoreComponents;
				}

				function lexCoreComponents(lexer) {
					const what = lexer.data.isLink ? 'link' : 'image';
					let delim = Delim.None;

					for (;;) {
						switch (lexer.next()) {
						case EOF:
						case '\n':
							return lexer.error(Item.Error, `unterminated ${what} markup`);

						case '"':
							/*
								This is not entirely reliable within sections that allow raw strings, since
								it's possible, however unlikely, for a raw string to contain unpaired double
								quotes.  The likelihood is low enough, however, that I'm deeming the risk as
								acceptable—for now, at least.
							*/
							if (slurpQuote(lexer, '"') === EOF) {
								return lexer.error(Item.Error, `unterminated double quoted string in ${what} markup`);
							}
							break;

						case '|': // possible pipe ('|') delimiter
							if (delim === Delim.None) {
								delim = Delim.LTR;
								lexer.backup();
								lexer.emit(Item.Text);
								lexer.forward();
								lexer.emit(Item.DelimLTR);
								// lexer.ignore();
							}
							break;

						case '-': // possible right arrow ('->') delimiter
							if (delim === Delim.None && lexer.peek() === '>') {
								delim = Delim.LTR;
								lexer.backup();
								lexer.emit(Item.Text);
								lexer.forward(2);
								lexer.emit(Item.DelimLTR);
								// lexer.ignore();
							}
							break;

						case '<': // possible left arrow ('<-') delimiter
							if (delim === Delim.None && lexer.peek() === '-') {
								delim = Delim.RTL;
								lexer.backup();
								lexer.emit(lexer.data.isLink ? Item.Link : Item.Source);
								lexer.forward(2);
								lexer.emit(Item.DelimRTL);
								// lexer.ignore();
							}
							break;

						case '[':
							++lexer.depth;
							break;

						case ']':
							--lexer.depth;

							if (lexer.depth === 1) {
								switch (lexer.peek()) {
								case '[':
									++lexer.depth;
									lexer.backup();

									if (delim === Delim.RTL) {
										lexer.emit(Item.Text);
									}
									else {
										lexer.emit(lexer.data.isLink ? Item.Link : Item.Source);
									}

									lexer.forward(2);
									lexer.emit(Item.InnerMeta);
									// lexer.ignore();
									return lexer.data.isLink ? lexSetter : lexImageLink;

								case ']':
									--lexer.depth;
									lexer.backup();

									if (delim === Delim.RTL) {
										lexer.emit(Item.Text);
									}
									else {
										lexer.emit(lexer.data.isLink ? Item.Link : Item.Source);
									}

									lexer.forward(2);
									lexer.emit(Item.RightMeta);
									// lexer.ignore();
									return null;

								default:
									return lexer.error(Item.Error, `malformed ${what} markup`);
								}
							}
							break;
						}
					}
				}

				function lexImageLink(lexer) {
					const what = lexer.data.isLink ? 'link' : 'image';

					for (;;) {
						switch (lexer.next()) {
						case EOF:
						case '\n':
							return lexer.error(Item.Error, `unterminated ${what} markup`);

						case '"':
							/*
								This is not entirely reliable within sections that allow raw strings, since
								it's possible, however unlikely, for a raw string to contain unpaired double
								quotes.  The likelihood is low enough, however, that I'm deeming the risk as
								acceptable—for now, at least.
							*/
							if (slurpQuote(lexer, '"') === EOF) {
								return lexer.error(Item.Error, `unterminated double quoted string in ${what} markup link component`);
							}
							break;

						case '[':
							++lexer.depth;
							break;

						case ']':
							--lexer.depth;

							if (lexer.depth === 1) {
								switch (lexer.peek()) {
								case '[':
									++lexer.depth;
									lexer.backup();
									lexer.emit(Item.Link);
									lexer.forward(2);
									lexer.emit(Item.InnerMeta);
									// lexer.ignore();
									return lexSetter;

								case ']':
									--lexer.depth;
									lexer.backup();
									lexer.emit(Item.Link);
									lexer.forward(2);
									lexer.emit(Item.RightMeta);
									// lexer.ignore();
									return null;

								default:
									return lexer.error(Item.Error, `malformed ${what} markup`);
								}
							}
							break;
						}
					}
				}

				function lexSetter(lexer) {
					const what = lexer.data.isLink ? 'link' : 'image';

					for (;;) {
						switch (lexer.next()) {
						case EOF:
						case '\n':
							return lexer.error(Item.Error, `unterminated ${what} markup`);

						case '"':
							if (slurpQuote(lexer, '"') === EOF) {
								return lexer.error(Item.Error, `unterminated double quoted string in ${what} markup setter component`);
							}
							break;

						case "'":
							if (slurpQuote(lexer, "'") === EOF) {
								return lexer.error(Item.Error, `unterminated single quoted string in ${what} markup setter component`);
							}
							break;

						case '[':
							++lexer.depth;
							break;

						case ']':
							--lexer.depth;

							if (lexer.depth === 1) {
								if (lexer.peek() !== ']') {
									return lexer.error(Item.Error, `malformed ${what} markup`);
								}

								--lexer.depth;
								lexer.backup();
								lexer.emit(Item.Setter);
								lexer.forward(2);
								lexer.emit(Item.RightMeta);
								// lexer.ignore();
								return null;
							}
							break;
						}
					}
				}

				// Parse function.
				function parseSquareBracketedMarkup(w) {
					// Initialize the lexer.
					const lexer  = new Lexer(w.source, lexLeftMeta);

					// Set the initial positions within the source string.
					lexer.start = lexer.pos = w.matchStart;

					// Lex the raw argument string.
					const markup = {};
					const items  = lexer.run();
					const last   = items.last();

					if (last && last.type === Item.Error) {
						markup.error = last.message;
					}
					else {
						items.forEach(item => {
							const text = item.text.trim();

							switch (item.type) {
							case Item.ImageMeta:
								markup.isImage = true;

								if (text[1] === '<') {
									markup.align = 'left';
								}
								else if (text[1] === '>') {
									markup.align = 'right';
								}
								break;

							case Item.LinkMeta:
								markup.isLink = true;
								break;

							case Item.Link:
								if (text[0] === '~') {
									markup.forceInternal = true;
									markup.link = text.slice(1);
								}
								else {
									markup.link = text;
								}
								break;

							case Item.Setter:
								markup.setter = text;
								break;

							case Item.Source:
								markup.source = text;
								break;

							case Item.Text:
								markup.text = text;
								break;
							}
						});
					}

					markup.pos = lexer.pos;
					return markup;
				}

				return parseSquareBracketedMarkup;
				/* eslint-enable no-param-reassign */
			})()
		}
	});


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Wikifier;
})();
/* eslint-enable max-len */

/***********************************************************************************************************************

	markup/parserlib.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/*
	global Config, DebugView, EOF, Engine, Lexer, Macro, MacroContext, Patterns, Scripting, State, Story, Template,
	       Wikifier, stringFrom, throwError
*/
/* eslint "no-param-reassign": [ 2, { "props" : false } ] */

(() => {
	'use strict';

	/*******************************************************************************************************************
		Utility Functions.
	*******************************************************************************************************************/
	function _verbatimTagHandler(w) {
		this.lookahead.lastIndex = w.matchStart;

		const match = this.lookahead.exec(w.source);

		if (match && match.index === w.matchStart) {
			w.nextMatch = this.lookahead.lastIndex;

			jQuery(document.createDocumentFragment())
				.append(match[1])
				.appendTo(w.output);
		}
	}


	/*******************************************************************************************************************
		Parsers.
	*******************************************************************************************************************/
	Wikifier.Parser.add({
		name       : 'quoteByBlock',
		profiles   : ['block'],
		match      : '^<<<\\n',
		terminator : '^<<<\\n',

		handler(w) {
			if (!Wikifier.helpers.hasBlockContext(w.output.childNodes)) {
				jQuery(w.output).append(document.createTextNode(w.matchText));
				return;
			}

			w.subWikify(
				jQuery(document.createElement('blockquote'))
					.appendTo(w.output)
					.get(0),
				this.terminator
			);
		}
	});

	Wikifier.Parser.add({
		name       : 'quoteByLine',
		profiles   : ['block'],
		match      : '^>+',
		lookahead  : /^>+/gm,
		terminator : '\\n',

		handler(w) {
			if (!Wikifier.helpers.hasBlockContext(w.output.childNodes)) {
				jQuery(w.output).append(document.createTextNode(w.matchText));
				return;
			}

			const destStack = [w.output];
			let curLevel = 0;
			let newLevel = w.matchLength;
			let matched;
			let i;

			do {
				if (newLevel > curLevel) {
					for (i = curLevel; i < newLevel; ++i) {
						destStack.push(
							jQuery(document.createElement('blockquote'))
								.appendTo(destStack[destStack.length - 1])
								.get(0)
						);
					}
				}
				else if (newLevel < curLevel) {
					for (i = curLevel; i > newLevel; --i) {
						destStack.pop();
					}
				}

				curLevel = newLevel;
				w.subWikify(destStack[destStack.length - 1], this.terminator);
				jQuery(document.createElement('br')).appendTo(destStack[destStack.length - 1]);

				this.lookahead.lastIndex = w.nextMatch;

				const match = this.lookahead.exec(w.source);

				matched = match && match.index === w.nextMatch;

				if (matched) {
					newLevel = match[0].length;
					w.nextMatch += match[0].length;
				}
			} while (matched);
		}
	});

	/*
	Changes to the default macro parser with 3 things:
	- Fixes an issue that causes tags that start with "end" to not get parsed, therefore not providing a payload.
	- Adds support for object literals as macro arguments.
		Extends the functionality to accept object literals directly, eliminating
		the need to use template literals or other workarounds to pass complex data structures.

		Also allows us to define arrow function inside object literals.

		Example usage:
		Before: <<macroName `{"key": "value"}`>>
		After:  <<macroName {key:"value"}>>

		Arrow function:  <<macroName {key: () => "returnvalue"}>>

	- Adds support for function calls as macro arguments.
		Extends the functionality to accept function calls anywhere in the argument list.
		Before any function call was converted into a string.

		Example usage:
			<<macroName "arg1" myFunction("param") "arg3">>
			<<macroName "arg1" myFunction("longer string") "arg3">>
	*/
	Wikifier.Parser.add({
		name      : 'macro',
		profiles  : ['core'],
		match     : '<<',
		lookahead : new RegExp(`<<(/?${Patterns.macroName})(?:\\s*)((?:(?:/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/)|(?://.*\\n)|(?:\`(?:\\\\.|[^\`\\\\])*\`)|(?:"(?:\\\\.|[^"\\\\])*")|(?:'(?:\\\\.|[^'\\\\])*')|(?:\\[(?:[<>]?[Ii][Mm][Gg])?\\[[^\\r\\n]*?\\]\\]+)|[^>]|(?:>(?!>)))*)>>`, 'gm'),
		working   : { source : '', name : '', arguments : '', index : 0 }, // the working parse object
		context   : null, // last execution context object (top-level macros, hierarchically, have a null context)

		handler(w) {
			const matchStart = this.lookahead.lastIndex = w.matchStart;

			if (this.parseTag(w)) {
				/*
					If `parseBody()` is called below, it will modify the current working
					values, so we must cache them now.
				*/
				const nextMatch = w.nextMatch;
				const name      = this.working.name;
				const rawArgs   = this.working.arguments;
				let macro;

				try {
					macro = Macro.get(name);

					if (macro) {
						let payload = null;

						if (typeof macro.tags !== 'undefined') {
							payload = this.parseBody(w, macro);

							if (!payload) {
								w.nextMatch = nextMatch; // we must reset `w.nextMatch` here, as `parseBody()` modifies it
								return throwError(
									w.output,
									`cannot find a closing tag for macro <<${name}>>`,
									`${w.source.slice(matchStart, w.nextMatch)}\u2026`
								);
							}
						}

						if (typeof macro.handler === 'function') {
							const args = !payload
								? this.createArgs(rawArgs, this.skipArgs(macro, macro.name))
								: payload[0].args;

							/*
								New-style macros.
							*/
							if (typeof macro._MACRO_API !== 'undefined') {
								/*
									Add the macro's execution context to the context chain.
								*/
								this.context = new MacroContext({
									macro,
									name,
									args,
									payload,
									source : w.source.slice(matchStart, w.nextMatch),
									parent : this.context,
									parser : w
								});

								/*
									Call the handler.

									NOTE: There's no catch clause here because this try/finally exists solely
									to ensure that the execution context is properly restored in the event
									that an uncaught exception is thrown during the handler call.
								*/
								try {
									macro.handler.call(this.context);
									/*
										QUESTION: Swap to the following, which passes macro arguments in
										as parameters to the handler function, in addition to them being
										available on its `this`?  If so, it might still be something to
										hold off on until v3, when the legacy macro API is removed.

										macro.handler.apply(this.context, this.context.args);
									*/
								}
								finally {
									// eslint-disable-next-line max-depth
									if (macro.isWidget && Wikifier.stopWikify === 1) {
										Wikifier.stopWikify = 0;
									}
									this.context = this.context.parent;
								}
							}
							/*
								[DEPRECATED] Old-style/legacy macros.
							*/
							else {
								/*
									Set up the raw arguments string.
								*/
								const prevRawArgs = w._rawArgs;
								w._rawArgs = rawArgs;

								/*
									Call the handler.

									NOTE: There's no catch clause here because this try/finally exists solely
									to ensure that the previous raw arguments string is properly restored in
									the event that an uncaught exception is thrown during the handler call.
								*/
								try {
									macro.handler(w.output, name, args, w, payload);
								}
								finally {
									w._rawArgs = prevRawArgs;
								}
							}
						}
						else {
							return throwError(
								w.output,
								`macro <<${name}>> handler function ${typeof macro.handler === 'undefined' ? 'does not exist' : 'is not a function'}`,
								w.source.slice(matchStart, w.nextMatch)
							);
						}
					}
					else if (Macro.tags.has(name)) {
						const tags = Macro.tags.get(name);
						return throwError(
							w.output,
							`child tag <<${name}>> was found outside of a call to its parent macro${tags.length === 1 ? '' : 's'} <<${tags.join('>>, <<')}>>`,
							w.source.slice(matchStart, w.nextMatch)
						);
					}
					else {
						return throwError(
							w.output,
							`macro <<${name}>> does not exist`,
							w.source.slice(matchStart, w.nextMatch)
						);
					}
				}
				catch (ex) {
					return throwError(
						w.output,
						`cannot execute ${macro && macro.isWidget ? 'widget' : 'macro'} <<${name}>>: ${ex.message}`,
						w.source.slice(matchStart, w.nextMatch)
					);
				}
				finally {
					this.working.source    = '';
					this.working.name      = '';
					this.working.arguments = '';
					this.working.index     = 0;
				}
			}
			else {
				w.outputText(w.output, w.matchStart, w.nextMatch);
			}
		},

		parseTag(w) {
			const match = this.lookahead.exec(w.source);

			if (match && match.index === w.matchStart && match[1]) {
				w.nextMatch = this.lookahead.lastIndex;

				this.working.source    = w.source.slice(match.index, this.lookahead.lastIndex);
				this.working.name      = match[1];
				this.working.arguments = match[2];
				this.working.index     = match.index;

				return true;
			}

			return false;
		},

		parseBody(w, macro) {
			const openTag  = this.working.name;
			const closeTag = `/${openTag}`;
			const closeAlt = `end${openTag}`;
			const bodyTags = Array.isArray(macro.tags) ? macro.tags : false;
			const payload  = [];
			let end          = -1;
			let opened       = 1;
			let curSource    = this.working.source;
			let curTag       = this.working.name;
			let curArgument  = this.working.arguments;
			let contentStart = w.nextMatch;

			while ((w.matchStart = w.source.indexOf(this.match, w.nextMatch)) !== -1) {
				if (!this.parseTag(w)) {
					this.lookahead.lastIndex = w.nextMatch = w.matchStart + this.match.length;
					continue;
				}

				const tagSource = this.working.source;
				const tagName   = this.working.name;
				const tagArgs   = this.working.arguments;
				const tagBegin  = this.working.index;
				const tagEnd    = w.nextMatch;
				const hasArgs   = tagArgs.trim() !== '';

				switch (tagName) {
				case openTag:
					++opened;
					break;

				case closeAlt:
				case closeTag:
					if (hasArgs) {
						// Skip over malformed closing tags and throw.
						w.nextMatch = tagBegin + 2 + tagName.length;
						throw new Error(`malformed closing tag: "${tagSource}"`);
					}
					--opened;
					break;

				default:
					if (hasArgs && tagName.startsWith('/')) { // tags starting with 'end' used to have same treatment
						// Skip over malformed alien closing tags.
						this.lookahead.lastIndex = w.nextMatch = tagBegin + 2 + tagName.length;
						continue;
					}
					if (opened === 1 && bodyTags) {
						for (let i = 0, iend = bodyTags.length; i < iend; ++i) {
							if (tagName === bodyTags[i]) {
								payload.push({
									source    : curSource,
									name      : curTag,
									arguments : curArgument,
									args      : this.createArgs(curArgument, this.skipArgs(macro, curTag)),
									contents  : w.source.slice(contentStart, tagBegin)
								});
								curSource    = tagSource;
								curTag       = tagName;
								curArgument  = tagArgs;
								contentStart = tagEnd;
							}
						}
					}
					break;
				}

				if (opened === 0) {
					payload.push({
						source    : curSource,
						name      : curTag,
						arguments : curArgument,
						args      : this.createArgs(curArgument, this.skipArgs(macro, curTag)),
						contents  : w.source.slice(contentStart, tagBegin)
					});
					end = tagEnd;
					break;
				}
			}

			if (end !== -1) {
				w.nextMatch = end;
				return payload;
			}

			return null;
		},

		createArgs(rawArgsString, skipArgs) {
			const args = skipArgs ? [] : this.parseArgs(rawArgsString);

			// Extend the args array with the raw and full argument strings.
			Object.defineProperties(args, {
				raw : {
					value : rawArgsString
				},
				full : {
					value : Scripting.parse(rawArgsString)
				}
			});

			return args;
		},

		skipArgs(macro, tagName) {
			if (typeof macro.skipArgs !== 'undefined') {
				const sa = macro.skipArgs;

				return typeof sa === 'boolean' && sa || Array.isArray(sa) && sa.includes(tagName);
			}
			/* legacy */
			else if (typeof macro.skipArg0 !== 'undefined') {
				return macro.skipArg0 && macro.name === tagName;
			}
			/* /legacy */

			return false;
		},

		parseArgs : (() => {
			const Item = Lexer.enumFromNames([ // lex item types object (pseudo-enumeration)
				'Error',         // error
				'Bareword',      // bare identifier
				'Expression',    // expression (backquoted)
				'String',        // quoted string (single or double)
				'SquareBracket', // [[…]] or [img[…]]
				'ObjectLiteral',
				'FunctionCall'
			]);
			const spaceRe    = new RegExp(Patterns.space);
			const notSpaceRe = new RegExp(Patterns.notSpace);
			const varTest    = new RegExp(`^${Patterns.variable}`);

			// Lexing functions.
			function slurpQuote(lexer, endQuote) {
				loop: for (;;) {
					/* eslint-disable indent */
					switch (lexer.next()) {
					case '\\':
						{
							const ch = lexer.next();

							if (ch !== EOF && ch !== '\n') {
								break;
							}
						}
						/* falls through */
					case EOF:
					case '\n':
						return EOF;

					case endQuote:
						break loop;
					}
					/* eslint-enable indent */
				}
				return lexer.pos;
			}

			function genericSlurp(lexer, openChar, closeChar, initCount) {
				let count = initCount;

				loop: for (;;) {
					const ch = lexer.next();

					switch (ch) {
					case openChar:
						count++;
						break;

					case closeChar:
						count--;

						if (count === 0) {
							break loop;
						}

						break;

					case EOF:
					case '\n':
						return false;
					}
				}
				return lexer.pos;
			}

			function lexSpace(lexer) {
				const offset = lexer.source.slice(lexer.pos).search(notSpaceRe);
				let remainingStr = lexer.source.slice(lexer.pos); // Capture the remaining part of the string for lookahead

				if (offset === EOF) {
					// no non-whitespace characters, so bail
					return null;
				}
				else if (offset !== 0) {
					lexer.pos += offset;
					lexer.ignore();
					remainingStr = lexer.source.slice(lexer.pos); // Update remainingStr after skipping spaces
				}

				// Check if the next token looks like a function call
				if (/^[a-zA-Z_$][0-9a-zA-Z_$]*\s*\(/.test(remainingStr)) {
					lexer.next(); // Advance the lexer's position to skip the first character of the function name
					return lexFunctionCall;
				}

				// determine what the next state is
				switch (lexer.next()) {
				case '`':
					return lexExpression;
				case '"':
					return lexDoubleQuote;
				case "'":
					return lexSingleQuote;
				case '[':
					return lexSquareBracket;
				case '{':
					return lexObjectLiteral;
				default:
					return lexBareword;
				}
			}

			function lexExpression(lexer) {
				if (slurpQuote(lexer, '`') === EOF) {
					return lexer.error(Item.Error, 'unterminated backquote expression');
				}

				lexer.emit(Item.Expression);
				return lexSpace;
			}

			function lexDoubleQuote(lexer) {
				if (slurpQuote(lexer, '"') === EOF) {
					return lexer.error(Item.Error, 'unterminated double quoted string');
				}

				lexer.emit(Item.String);
				return lexSpace;
			}

			function lexSingleQuote(lexer) {
				if (slurpQuote(lexer, "'") === EOF) {
					return lexer.error(Item.Error, 'unterminated single quoted string');
				}

				lexer.emit(Item.String);
				return lexSpace;
			}

			function lexSquareBracket(lexer) {
				const imgMeta = '<>IiMmGg';
				let what;

				if (lexer.accept(imgMeta)) {
					what = 'image';
					lexer.acceptRun(imgMeta);
				}
				else {
					what = 'link';
				}

				if (!lexer.accept('[')) {
					return lexer.error(Item.Error, `malformed ${what} markup`);
				}

				// Initial depth is 2 to account for double brackets [[
				if (genericSlurp(lexer, '[', ']', 2) === EOF) {
					return lexer.error(Item.Error, `unterminated ${what} markup`);
				}

				lexer.emit(Item.SquareBracket);
				return lexSpace;
			}

			function lexObjectLiteral(lexer) {
				if (genericSlurp(lexer, '{', '}', 1) === EOF) {
					return lexer.error(Item.Error, 'unterminated object literal');
				}

				lexer.emit(Item.ObjectLiteral);
				return lexSpace;
			}

			function lexFunctionCall(lexer) {
				if (genericSlurp(lexer, '(', ')', 0) === EOF) {
					return lexer.error(Item.Error, 'unterminated function call');
				}
				lexer.emit(Item.FunctionCall);
				return lexSpace;
			}

			function lexBareword(lexer) {
				const offset = lexer.source.slice(lexer.pos).search(spaceRe);
				lexer.pos = offset === EOF ? lexer.source.length : lexer.pos + offset;
				lexer.emit(Item.Bareword);
				return offset === EOF ? null : lexSpace;
			}

			// Parse function.
			function parseMacroArgs(rawArgsString) {
				// Initialize the lexer.
				const lexer = new Lexer(rawArgsString, lexSpace);
				const args  = [];

				// Lex the raw argument string.
				lexer.run().forEach(item => {
					let arg = item.text;

					switch (item.type) {
					case Item.Error:
						throw new Error(`unable to parse macro argument "${arg}": ${item.message}`);

					case Item.Bareword:
						// A variable, so substitute its value.
						if (varTest.test(arg)) {
							arg = State.getVar(arg);
						}
						// Property access on the settings or setup objects, so try to evaluate it.
						else if (/^(?:settings|setup)[.[]/.test(arg)) {
							try {
								arg = Scripting.evalTwineScript(arg);
							}
							catch (ex) {
								throw new Error(`unable to parse macro argument "${arg}": ${ex.message}`);
							}
						}

						// Null literal, so convert it into null.
						else if (arg === 'null') {
							arg = null;
						}

						// Undefined literal, so convert it into undefined.
						else if (arg === 'undefined') {
							arg = undefined;
						}

						// Boolean true literal, so convert it into true.
						else if (arg === 'true') {
							arg = true;
						}

						// Boolean false literal, so convert it into false.
						else if (arg === 'false') {
							arg = false;
						}

						// NaN literal, so convert it into NaN.
						else if (arg === 'NaN') {
							arg = NaN;
						}

						// Attempt to convert it into a number, in case it's a numeric literal.
						else {
							const argAsNum = Number(arg);

							if (!Number.isNaN(argAsNum)) {
								arg = argAsNum;
							}
						}
						break;

					case Item.Expression:
						arg = arg.slice(1, -1).trim(); // remove the backquotes and trim the expression

						// Empty backquotes.
						if (arg === '') {
							arg = undefined;
						}

						// Evaluate the expression.
						else {
							try {
								/*
									The enclosing parenthesis here are necessary to force a code string
									consisting solely of an object literal to be evaluated as such, rather
									than as a code block.
								*/
								arg = Scripting.evalTwineScript(`(${arg})`);
							}
							catch (ex) {
								throw new Error(`unable to parse macro argument expression "${arg}": ${ex.message}`);
							}
						}
						break;

					case Item.String:
						// Evaluate the string to handle escaped characters.
						try {
							arg = Scripting.evalJavaScript(arg);
						}
						catch (ex) {
							throw new Error(`unable to parse macro argument string "${arg}": ${ex.message}`);
						}
						break;

					case Item.SquareBracket:
						{
							const markup = Wikifier.helpers.parseSquareBracketedMarkup({
								source     : arg,
								matchStart : 0
							});

							if (markup.hasOwnProperty('error')) {
								throw new Error(`unable to parse macro argument "${arg}": ${markup.error}`);
							}

							if (markup.pos < arg.length) {
								throw new Error(`unable to parse macro argument "${arg}": unexpected character(s) "${arg.slice(markup.pos)}" (pos: ${markup.pos})`);
							}

							// Convert to a link or image object.
							if (markup.isLink) {
								// .isLink, [.text], [.forceInternal], .link, [.setter]
								arg = { isLink : true };
								arg.count    = markup.hasOwnProperty('text') ? 2 : 1;
								arg.link     = Wikifier.helpers.evalPassageId(markup.link);
								arg.text     = markup.hasOwnProperty('text') ? Wikifier.helpers.evalText(markup.text) : arg.link;
								arg.external = !markup.forceInternal && Wikifier.isExternalLink(arg.link);
								arg.setFn    = markup.hasOwnProperty('setter')
									? Wikifier.helpers.createShadowSetterCallback(Scripting.parse(markup.setter))
									: null;
							}
							else if (markup.isImage) {
								// .isImage, [.align], [.title], .source, [.forceInternal], [.link], [.setter]
								arg = (source => {
									const imgObj = {
										source,
										isImage : true
									};

									// Check for Twine 1.4 Base64 image passage transclusion.
									if (source.slice(0, 5) !== 'data:' && Story.has(source)) {
										const passage = Story.get(source);

										if (passage.tags.includes('Twine.image')) {
											imgObj.source  = passage.text;
											imgObj.passage = passage.title;
										}
									}

									return imgObj;
								})(Wikifier.helpers.evalPassageId(markup.source));

								if (markup.hasOwnProperty('align')) {
									arg.align = markup.align;
								}

								if (markup.hasOwnProperty('text')) {
									arg.title = Wikifier.helpers.evalText(markup.text);
								}

								if (markup.hasOwnProperty('link')) {
									arg.link     = Wikifier.helpers.evalPassageId(markup.link);
									arg.external = !markup.forceInternal && Wikifier.isExternalLink(arg.link);
								}

								arg.setFn = markup.hasOwnProperty('setter')
									? Wikifier.helpers.createShadowSetterCallback(Scripting.parse(markup.setter))
									: null;
							}
						}
						break;
					case Item.ObjectLiteral:
						try {
							arg = Scripting.evalTwineScript(`(${arg})`);
						}
						catch (ex) {
							throw new Error(`unable to parse macro argument object literal "${arg}": ${ex.message}`);
						}
						break;
					case Item.FunctionCall:
						try {
							arg = Scripting.evalTwineScript(arg);
						}
						catch (ex) {
							throw new Error(`unable to parse macro argument "${arg}": ${ex.message}`);
						}
						break;
					}

					args.push(arg);
				});

				return args;
			}

			return parseMacroArgs;
		})()
	});


	Wikifier.Parser.add({
		name     : 'link',
		profiles : ['core'],
		match    : '\\[\\[[^[]',

		handler(w) {
			const markup = Wikifier.helpers.parseSquareBracketedMarkup(w);

			if (markup.hasOwnProperty('error')) {
				w.outputText(w.output, w.matchStart, w.nextMatch);
				return;
			}

			w.nextMatch = markup.pos;

			// text=(text), forceInternal=(~), link=link, setter=(setter)
			const link  = Wikifier.helpers.evalPassageId(markup.link);
			const text  = markup.hasOwnProperty('text') ? Wikifier.helpers.evalText(markup.text) : link;
			const setFn = markup.hasOwnProperty('setter')
				? Wikifier.helpers.createShadowSetterCallback(Scripting.parse(markup.setter))
				: null;

			// Debug view setup.
			const output = (Config.debug
				? new DebugView(w.output, 'link-markup', '[[link]]', w.source.slice(w.matchStart, w.nextMatch))
				: w
			).output;

			if (markup.forceInternal || !Wikifier.isExternalLink(link)) {
				Wikifier.createInternalLink(output, link, text, setFn);
			}
			else {
				Wikifier.createExternalLink(output, link, text);
			}
		}
	});

	Wikifier.Parser.add({
		name     : 'urlLink',
		profiles : ['core'],
		match    : Patterns.url,

		handler(w) {
			w.outputText(Wikifier.createExternalLink(w.output, w.matchText), w.matchStart, w.nextMatch);
		}
	});

	Wikifier.Parser.add({
		name     : 'image',
		profiles : ['core'],
		match    : '\\[[<>]?[Ii][Mm][Gg]\\[',

		handler(w) {
			const markup = Wikifier.helpers.parseSquareBracketedMarkup(w);

			if (markup.hasOwnProperty('error')) {
				w.outputText(w.output, w.matchStart, w.nextMatch);
				return;
			}

			w.nextMatch = markup.pos;

			// Debug view setup.
			let debugView;

			if (Config.debug) {
				debugView = new DebugView(
					w.output,
					'image-markup',
					markup.hasOwnProperty('link') ? '[img[][link]]' : '[img[]]',
					w.source.slice(w.matchStart, w.nextMatch)
				);
				debugView.modes({ block : true });
			}

			// align=(left|right), title=(title), source=source, forceInternal=(~), link=(link), setter=(setter)
			const setFn = markup.hasOwnProperty('setter')
				? Wikifier.helpers.createShadowSetterCallback(Scripting.parse(markup.setter))
				: null;
			let el     = (Config.debug ? debugView : w).output;
			let source;

			if (markup.hasOwnProperty('link')) {
				const link = Wikifier.helpers.evalPassageId(markup.link);

				if (markup.forceInternal || !Wikifier.isExternalLink(link)) {
					el = Wikifier.createInternalLink(el, link, null, setFn);
				}
				else {
					el = Wikifier.createExternalLink(el, link);
				}

				el.classList.add('link-image');
			}

			el = jQuery(document.createElement('img'))
				.appendTo(el)
				.get(0);
			source = Wikifier.helpers.evalPassageId(markup.source);

			// Check for image passage transclusion.
			if (source.slice(0, 5) !== 'data:' && Story.has(source)) {
				const passage = Story.get(source);

				if (passage.tags.includes('Twine.image')) {
					el.setAttribute('data-passage', passage.title);
					source = passage.text.trim();
				}
			}

			el.src = source;

			if (markup.hasOwnProperty('text')) {
				el.title = Wikifier.helpers.evalText(markup.text);
			}

			if (markup.hasOwnProperty('align')) {
				el.align = markup.align;
			}
		}
	});

	Wikifier.Parser.add({
		name      : 'monospacedByBlock',
		profiles  : ['block'],
		match     : '^\\{\\{\\{\\n',
		lookahead : /^\{\{\{\n((?:^[^\n]*\n)+?)(^\}\}\}$\n?)/gm,

		handler(w) {
			this.lookahead.lastIndex = w.matchStart;

			const match = this.lookahead.exec(w.source);

			if (match && match.index === w.matchStart) {
				const pre = jQuery(document.createElement('pre'));
				jQuery(document.createElement('code'))
					.text(match[1])
					.appendTo(pre);
				pre.appendTo(w.output);
				w.nextMatch = this.lookahead.lastIndex;
			}
		}
	});

	Wikifier.Parser.add({
		name     : 'formatByChar',
		profiles : ['core'],
		match    : "''|//|__|\\^\\^|~~|==|\\{\\{\\{",

		handler(w) {
			switch (w.matchText) {
			case "''":
				w.subWikify(jQuery(document.createElement('strong')).appendTo(w.output).get(0), "''");
				break;

			case '//':
				w.subWikify(jQuery(document.createElement('em')).appendTo(w.output).get(0), '//');
				break;

			case '__':
				w.subWikify(jQuery(document.createElement('u')).appendTo(w.output).get(0), '__');
				break;

			case '^^':
				w.subWikify(jQuery(document.createElement('sup')).appendTo(w.output).get(0), '\\^\\^');
				break;

			case '~~':
				w.subWikify(jQuery(document.createElement('sub')).appendTo(w.output).get(0), '~~');
				break;

			case '==':
				w.subWikify(jQuery(document.createElement('s')).appendTo(w.output).get(0), '==');
				break;

			case '{{{':
				{
					const lookahead = /\{\{\{((?:.|\n)*?)\}\}\}/gm;

					lookahead.lastIndex = w.matchStart;

					const match = lookahead.exec(w.source);

					if (match && match.index === w.matchStart) {
						jQuery(document.createElement('code'))
							.text(match[1])
							.appendTo(w.output);
						w.nextMatch = lookahead.lastIndex;
					}
				}
				break;
			}
		}
	});

	Wikifier.Parser.add({
		name       : 'customStyle',
		profiles   : ['core'],
		match      : '@@',
		terminator : '@@',
		blockRe    : /\s*\n/gm,

		handler(w) {
			const css = Wikifier.helpers.inlineCss(w);

			this.blockRe.lastIndex = w.nextMatch; // must follow the call to `inlineCss()`

			const blockMatch = this.blockRe.exec(w.source);
			const blockLevel = blockMatch && blockMatch.index === w.nextMatch;
			const $el        = jQuery(document.createElement(blockLevel ? 'div' : 'span'))
				.appendTo(w.output);

			if (css.classes.length === 0 && css.id === '' && Object.keys(css.styles).length === 0) {
				$el.addClass('marked');
			}
			else {
				css.classes.forEach(className => $el.addClass(className));

				if (css.id !== '') {
					$el.attr('id', css.id);
				}

				$el.css(css.styles);
			}

			if (blockLevel) {
				// Skip the leading and, if it exists, trailing newlines.
				w.nextMatch += blockMatch[0].length;
				w.subWikify($el[0], `\\n?${this.terminator}`);
			}
			else {
				w.subWikify($el[0], this.terminator);
			}
		}
	});

	Wikifier.Parser.add({
		name      : 'verbatimText',
		profiles  : ['core'],
		match     : '"{3}|<[Nn][Oo][Ww][Ii][Kk][Ii]>',
		lookahead : /(?:"{3}((?:.|\n)*?)"{3})|(?:<[Nn][Oo][Ww][Ii][Kk][Ii]>((?:.|\n)*?)<\/[Nn][Oo][Ww][Ii][Kk][Ii]>)/gm,

		handler(w) {
			this.lookahead.lastIndex = w.matchStart;

			const match = this.lookahead.exec(w.source);

			if (match && match.index === w.matchStart) {
				w.nextMatch = this.lookahead.lastIndex;

				jQuery(document.createElement('span'))
					.addClass('verbatim')
					.text(match[1] || match[2])
					.appendTo(w.output);
			}
		}
	});

	Wikifier.Parser.add({
		name     : 'horizontalRule',
		profiles : ['core'],
		match    : '^----+$\\n?|<[Hh][Rr]\\s*/?>\\n?',

		handler(w) {
			jQuery(document.createElement('hr')).appendTo(w.output);
		}
	});

	Wikifier.Parser.add({
		name     : 'emdash',
		profiles : ['core'],
		match    : '--',

		handler(w) {
			jQuery(document.createTextNode('\u2014')).appendTo(w.output);
		}
	});

	Wikifier.Parser.add({
		name     : 'doubleDollarSign',
		profiles : ['core'],
		match    : '\\${2}', // eslint-disable-line no-template-curly-in-string

		handler(w) {
			jQuery(document.createTextNode('$')).appendTo(w.output);
		}
	});

	Wikifier.Parser.add({
		/*
			Supported syntax:
				$variable
				$variable.property
				$variable[numericIndex]
				$variable["property"]
				$variable['property']
				$variable[$indexOrPropertyVariable]

			NOTE: I really do not like how the initial bit of the regexp matches.
		*/
		name     : 'nakedVariable',
		profiles : ['core'],
		match    : `${Patterns.variable}(?:(?:\\.${Patterns.identifier})|(?:\\[\\d+\\])|(?:\\["(?:\\\\.|[^"\\\\])+"\\])|(?:\\['(?:\\\\.|[^'\\\\])+'\\])|(?:\\[${Patterns.variable}\\]))*`,

		handler(w) {
			const result = State.getVar(w.matchText);

			if (result == null) { // lazy equality for null
				jQuery(document.createTextNode(w.matchText)).appendTo(w.output);
			}
			else {
				new Wikifier(
					(Config.debug
						? new DebugView(w.output, 'variable', w.matchText, w.matchText) // Debug view setup.
						: w
					).output,
					stringFrom(result)
				);
			}
		}
	});

	Wikifier.Parser.add({
		name     : 'template',
		profiles : ['core'],
		match    : `\\?${Patterns.templateName}`,

		handler(w) {
			const name = w.matchText.slice(1);
			let template = Template.get(name);
			let result   = null;

			// If we have an array of templates, randomly choose one.
			if (template instanceof Array) {
				template = template.random();
			}

			switch (typeof template) {
			case 'function':
				try {
					result = stringFrom(template.call({ name }));
				}
				catch (ex) {
					return throwError(
						w.output,
						`cannot execute function template ?${name}: ${ex.message}`,
						w.source.slice(w.matchStart, w.nextMatch)
					);
				}
				break;
			case 'string':
				result = template;
				break;
			}

			if (result === null) {
				jQuery(document.createTextNode(w.matchText)).appendTo(w.output);
			}
			else {
				new Wikifier(
					(Config.debug
						? new DebugView(w.output, 'template', w.matchText, w.matchText) // Debug view setup.
						: w
					).output,
					result
				);
			}
		}
	});

	Wikifier.Parser.add({
		name       : 'heading',
		profiles   : ['block'],
		match      : '^!{1,6}',
		terminator : '\\n',

		handler(w) {
			if (!Wikifier.helpers.hasBlockContext(w.output.childNodes)) {
				jQuery(w.output).append(document.createTextNode(w.matchText));
				return;
			}

			w.subWikify(
				jQuery(document.createElement(`h${w.matchLength}`)).appendTo(w.output).get(0),
				this.terminator
			);
		}
	});

	Wikifier.Parser.add({
		name           : 'table',
		profiles       : ['block'],
		match          : '^\\|(?:[^\\n]*)\\|(?:[fhck]?)$',
		lookahead      : /^\|([^\n]*)\|([fhck]?)$/gm,
		rowTerminator  : '\\|(?:[cfhk]?)$\\n?',
		cellPattern    : '(?:\\|([^\\n\\|]*)\\|)|(\\|[cfhk]?$\\n?)',
		cellTerminator : '(?:\\u0020*)\\|',
		rowTypes       : { c : 'caption', f : 'tfoot', h : 'thead', '' : 'tbody' }, // eslint-disable-line id-length

		handler(w) {
			if (!Wikifier.helpers.hasBlockContext(w.output.childNodes)) {
				jQuery(w.output).append(document.createTextNode(w.matchText));
				return;
			}

			const table       = jQuery(document.createElement('table')).appendTo(w.output).get(0);
			const prevColumns = [];
			let curRowType    = null;
			let $rowContainer = null;
			let rowCount      = 0;
			let matched;

			w.nextMatch = w.matchStart;

			do {
				this.lookahead.lastIndex = w.nextMatch;

				const match = this.lookahead.exec(w.source);

				matched = match && match.index === w.nextMatch;

				if (matched) {
					const nextRowType = match[2];

					if (nextRowType === 'k') {
						table.className = match[1];
						w.nextMatch += match[0].length + 1;
					}
					else {
						if (nextRowType !== curRowType) {
							curRowType = nextRowType;
							$rowContainer = jQuery(document.createElement(this.rowTypes[nextRowType]))
								.appendTo(table);
						}

						if (curRowType === 'c') {
							$rowContainer.css('caption-side', rowCount === 0 ? 'top' : 'bottom');
							w.nextMatch += 1;
							w.subWikify($rowContainer[0], this.rowTerminator);
						}
						else {
							this.rowHandler(
								w,
								jQuery(document.createElement('tr'))
									.appendTo($rowContainer)
									.get(0),
								prevColumns
							);
						}

						++rowCount;
					}
				}
			} while (matched);
		},

		rowHandler(w, rowEl, prevColumns) {
			const cellRe = new RegExp(this.cellPattern, 'gm');
			let col         = 0;
			let curColCount = 1;
			let matched;

			do {
				cellRe.lastIndex = w.nextMatch;

				const cellMatch = cellRe.exec(w.source);

				matched = cellMatch && cellMatch.index === w.nextMatch;

				if (matched) {
					if (cellMatch[1] === '~') {
						const last = prevColumns[col];

						if (last) {
							++last.rowCount;
							last.$element
								.attr('rowspan', last.rowCount)
								.css('vertical-align', 'middle');
						}

						w.nextMatch = cellMatch.index + cellMatch[0].length - 1;
					}
					else if (cellMatch[1] === '>') {
						++curColCount;
						w.nextMatch = cellMatch.index + cellMatch[0].length - 1;
					}
					else if (cellMatch[2]) {
						w.nextMatch = cellMatch.index + cellMatch[0].length;
						break;
					}
					else {
						++w.nextMatch;

						const css = Wikifier.helpers.inlineCss(w);
						let spaceLeft  = false;
						let spaceRight = false;
						let $cell;

						while (w.source.substr(w.nextMatch, 1) === ' ') {
							spaceLeft = true;
							++w.nextMatch;
						}

						if (w.source.substr(w.nextMatch, 1) === '!') {
							$cell = jQuery(document.createElement('th')).appendTo(rowEl);
							++w.nextMatch;
						}
						else {
							$cell = jQuery(document.createElement('td')).appendTo(rowEl);
						}

						prevColumns[col] = {
							rowCount : 1,
							$element : $cell
						};

						if (curColCount > 1) {
							$cell.attr('colspan', curColCount);
							curColCount = 1;
						}

						w.subWikify($cell[0], this.cellTerminator);

						if (w.matchText.substr(w.matchText.length - 2, 1) === ' ') {
							spaceRight = true;
						}

						css.classes.forEach(className => $cell.addClass(className));

						if (css.id !== '') {
							$cell.attr('id', css.id);
						}

						if (spaceLeft && spaceRight) {
							css.styles['text-align'] = 'center';
						}
						else if (spaceLeft) {
							css.styles['text-align'] = 'right';
						}
						else if (spaceRight) {
							css.styles['text-align'] = 'left';
						}

						$cell.css(css.styles);

						w.nextMatch = w.nextMatch - 1;
					}

					++col;
				}
			} while (matched);
		}
	});

	Wikifier.Parser.add({
		name       : 'list',
		profiles   : ['block'],
		match      : '^(?:(?:\\*+)|(?:#+))',
		lookahead  : /^(?:(\*+)|(#+))/gm,
		terminator : '\\n',

		handler(w) {
			if (!Wikifier.helpers.hasBlockContext(w.output.childNodes)) {
				jQuery(w.output).append(document.createTextNode(w.matchText));
				return;
			}

			w.nextMatch = w.matchStart;

			const destStack = [w.output];
			let curType  = null;
			let curLevel = 0;
			let matched;
			let i;

			do {
				this.lookahead.lastIndex = w.nextMatch;

				const match = this.lookahead.exec(w.source);

				matched = match && match.index === w.nextMatch;

				if (matched) {
					const newType  = match[2] ? 'ol' : 'ul';
					const newLevel = match[0].length;

					w.nextMatch += match[0].length;

					if (newLevel > curLevel) {
						for (i = curLevel; i < newLevel; ++i) {
							destStack.push(
								jQuery(document.createElement(newType))
									.appendTo(destStack[destStack.length - 1])
									.get(0)
							);
						}
					}
					else if (newLevel < curLevel) {
						for (i = curLevel; i > newLevel; --i) {
							destStack.pop();
						}
					}
					else if (newLevel === curLevel && newType !== curType) {
						destStack.pop();
						destStack.push(
							jQuery(document.createElement(newType))
								.appendTo(destStack[destStack.length - 1])
								.get(0)
						);
					}

					curLevel = newLevel;
					curType = newType;
					w.subWikify(
						jQuery(document.createElement('li'))
							.appendTo(destStack[destStack.length - 1])
							.get(0),
						this.terminator
					);
				}
			} while (matched);
		}
	});

	Wikifier.Parser.add({
		name      : 'commentByBlock',
		profiles  : ['core'],
		match     : '(?:/(?:%|\\*))|(?:<!--)',
		lookahead : /(?:\/(%|\*)(?:(?:.|\n)*?)\1\/)|(?:<!--(?:(?:.|\n)*?)-->)/gm,

		handler(w) {
			this.lookahead.lastIndex = w.matchStart;

			const match = this.lookahead.exec(w.source);

			if (match && match.index === w.matchStart) {
				w.nextMatch = this.lookahead.lastIndex;
			}
		}
	});

	Wikifier.Parser.add({
		name     : 'lineContinuation',
		profiles : ['core'],

		// WARNING: The ordering here is important: end-of-line, start-of-line, end-of-string, start-of-string.
		match : `\\\\${Patterns.spaceNoTerminator}*\\n|\\n${Patterns.spaceNoTerminator}*\\\\|\\n?\\\\${Patterns.spaceNoTerminator}*$|^${Patterns.spaceNoTerminator}*\\\\\\n?`,

		handler(w) {
			w.nextMatch = w.matchStart + w.matchLength;
		}
	});

	Wikifier.Parser.add({
		name     : 'lineBreak',
		profiles : ['core'],
		match    : '\\n|<[Bb][Rr]\\s*/?>',

		handler(w) {
			if (!w.options.nobr) {
				jQuery(document.createElement('br')).appendTo(w.output);
			}
		}
	});

	Wikifier.Parser.add({
		name     : 'htmlCharacterReference',
		profiles : ['core'],
		match    : '(?:(?:&#?[0-9A-Za-z]{2,8};|.)(?:&#?(?:x0*(?:3[0-6][0-9A-Fa-f]|1D[C-Fc-f][0-9A-Fa-f]|20[D-Fd-f][0-9A-Fa-f]|FE2[0-9A-Fa-f])|0*(?:76[89]|7[7-9][0-9]|8[0-7][0-9]|761[6-9]|76[2-7][0-9]|84[0-3][0-9]|844[0-7]|6505[6-9]|6506[0-9]|6507[0-1]));)+|&#?[0-9A-Za-z]{2,8};)',

		handler(w) {
			jQuery(document.createDocumentFragment())
				.append(w.matchText)
				.appendTo(w.output);
		}
	});

	Wikifier.Parser.add({
		name     : 'xmlProlog',
		profiles : ['core'],
		match    : '<\\?[Xx][Mm][Ll][^>]*\\?>',

		handler(w) {
			w.nextMatch = w.matchStart + w.matchLength;
		}
	});

	Wikifier.Parser.add({
		name      : 'verbatimHtml',
		profiles  : ['core'],
		match     : '<[Hh][Tt][Mm][Ll]>',
		lookahead : /<[Hh][Tt][Mm][Ll]>((?:.|\n)*?)<\/[Hh][Tt][Mm][Ll]>/gm,
		handler   : _verbatimTagHandler
	});

	Wikifier.Parser.add({
		name      : 'verbatimScriptTag',
		profiles  : ['core'],
		match     : '<[Ss][Cc][Rr][Ii][Pp][Tt][^>]*>',
		lookahead : /(<[Ss][Cc][Rr][Ii][Pp][Tt]*>(?:.|\n)*?<\/[Ss][Cc][Rr][Ii][Pp][Tt]>)/gm,
		handler   : _verbatimTagHandler
	});

	Wikifier.Parser.add({
		name           : 'styleTag',
		profiles       : ['core'],
		match          : '<[Ss][Tt][Yy][Ll][Ee][^>]*>',
		lookahead      : /(<[Ss][Tt][Yy][Ll][Ee]*>)((?:.|\n)*?)(<\/[Ss][Tt][Yy][Ll][Ee]>)/gm,
		imageMarkup    : new RegExp(Patterns.cssImage, 'g'),
		hasImageMarkup : new RegExp(Patterns.cssImage),

		handler(w) {
			this.lookahead.lastIndex = w.matchStart;

			const match = this.lookahead.exec(w.source);

			if (match && match.index === w.matchStart) {
				w.nextMatch = this.lookahead.lastIndex;

				let css = match[2];

				// Check for wiki image transclusion.
				if (this.hasImageMarkup.test(css)) {
					this.imageMarkup.lastIndex = 0;

					css = css.replace(this.imageMarkup, wikiImage => {
						const markup = Wikifier.helpers.parseSquareBracketedMarkup({
							source     : wikiImage,
							matchStart : 0
						});

						if (markup.hasOwnProperty('error') || markup.pos < wikiImage.length) {
							return wikiImage;
						}

						let source = markup.source;

						// Handle image passage transclusion.
						if (source.slice(0, 5) !== 'data:' && Story.has(source)) {
							const passage = Story.get(source);

							if (passage.tags.includes('Twine.image')) {
								source = passage.text;
							}
						}

						/*
							The source may be URI- or Base64-encoded, so we cannot use `encodeURIComponent()`
							here.  Instead, we simply encode any double quotes, since the URI will be
							delimited by them.
						*/
						return `url("${source.replace(/"/g, '%22')}")`;
					});
				}

				jQuery(document.createDocumentFragment())
					.append(match[1] + css + match[3])
					.appendTo(w.output);
			}
		}
	});

	Wikifier.Parser.add({
		name      : 'svgTag',
		profiles  : ['core'],
		match     : '<[Ss][Vv][Gg][^>]*>',
		lookahead : /<(\/?)[Ss][Vv][Gg][^>]*>/gm,
		namespace : 'http://www.w3.org/2000/svg',

		handler(w) {
			this.lookahead.lastIndex = w.nextMatch;

			let depth = 1;
			let match;

			while (depth > 0 && (match = this.lookahead.exec(w.source)) !== null) {
				depth += match[1] === '/' ? -1 : 1;
			}

			if (depth === 0) {
				w.nextMatch = this.lookahead.lastIndex;

				const svgTag = w.source.slice(w.matchStart, this.lookahead.lastIndex);
				const $frag  = jQuery(document.createDocumentFragment()).append(svgTag);

				// Postprocess the relevant SVG element nodes.
				$frag.find('a[data-passage],image[data-passage]').each((_, el) => {
					const tagName = el.tagName.toLowerCase();

					try {
						this.processAttributeDirectives(el);
					}
					catch (ex) {
						return throwError(
							w.output,
							`svg|<${tagName}>: ${ex.message}`,
							`${w.matchText}\u2026`
						);
					}

					if (el.hasAttribute('data-passage')) {
						this.processDataAttributes(el, tagName);
					}
				});

				$frag.appendTo(w.output);
			}
		},

		processAttributeDirectives(el) {
			// NOTE: The `.attributes` property yields a live collection, so we
			// must make a non-live copy of it as we will be adding and removing
			// members of said collection if any directives are found.
			[...el.attributes].forEach(({ name, value }) => {
				const evalShorthand = name[0] === '@';

				if (evalShorthand || name.startsWith('sc-eval:')) {
					const newName = name.slice(evalShorthand ? 1 : 8); // Remove eval directive prefix.

					if (newName === 'data-setter') {
						throw new Error(`evaluation directive is not allowed on the data-setter attribute: "${name}"`);
					}

					let result;

					// Evaluate the value as TwineScript.
					try {
						result = Scripting.evalTwineScript(value);
					}
					catch (ex) {
						throw new Error(`bad evaluation from attribute directive "${name}": ${ex.message}`);
					}

					// Assign the result to the new attribute and remove the old one.
					try {
						/*
							NOTE: Most browsers (ca. Nov 2017) have broken `setAttribute()`
							method implementations that throw on attribute names that start
							with, or contain, various symbols that are completely valid per
							the specification.  Thus this code could fail if the user chooses
							attribute names that, after removing the directive prefix, are
							unpalatable to `setAttribute()`.
						*/
						el.setAttribute(newName, result);
						el.removeAttribute(name);
					}
					catch (ex) {
						throw new Error(`cannot transform attribute directive "${name}" into attribute "${newName}"`);
					}
				}
			});
		},

		processDataAttributes(el, tagName) {
			let passage = el.getAttribute('data-passage');

			if (passage == null) { // lazy equality for null
				return;
			}

			const evaluated = Wikifier.helpers.evalPassageId(passage);

			if (evaluated !== passage) {
				passage = evaluated;
				el.setAttribute('data-passage', evaluated);
			}

			if (passage !== '') {
				// '<image>' element, so attempt media passage transclusion.
				if (tagName === 'image') {
					if (passage.slice(0, 5) !== 'data:' && Story.has(passage)) {
						passage = Story.get(passage);

						if (passage.tags.includes('Twine.image')) {
							// NOTE: SVG `.href` IDL attribute is read-only,
							// so set its `href` content attribute instead.
							el.setAttribute('href', passage.text.trim());
						}
					}
				}

				// Elsewise, assume a link element of some type—e.g., '<a>'.
				else {
					let setter = el.getAttribute('data-setter');
					let setFn;

					if (setter != null) { // lazy equality for null
						setter = String(setter).trim();

						if (setter !== '') {
							setFn = Wikifier.helpers.createShadowSetterCallback(Scripting.parse(setter));
						}
					}

					if (Story.has(passage)) {
						el.classList.add('link-internal');

						if (Config.addVisitedLinkClass && State.hasPlayed(passage)) {
							el.classList.add('link-visited');
						}
					}
					else {
						el.classList.add('link-broken');
					}

					jQuery(el).ariaClick({ one : true }, function () {
						if (typeof setFn === 'function') {
							setFn.call(this);
						}

						Engine.play(passage);
					});
				}
			}
		}
	});

	Wikifier.Parser.add({
		/*
			NOTE: This parser MUST come after any parser which handles HTML tag-
			like constructs—e.g. 'verbatimText', 'horizontalRule', 'lineBreak',
			'xmlProlog', 'verbatimHtml', 'verbatimSvgTag', 'verbatimScriptTag',
			and 'styleTag'.
		*/
		name      : 'htmlTag',
		profiles  : ['core'],
		match     : `<${Patterns.htmlTagName}(?:\\s+[^\\u0000-\\u001F\\u007F-\\u009F\\s"'>\\/=]+(?:\\s*=\\s*(?:"[^"]*?"|'[^']*?'|[^\\s"'=<>\`]+))?)*\\s*\\/?>`,
		tagRe     : new RegExp(`^<(${Patterns.htmlTagName})`),
		mediaTags : ['audio', 'img', 'source', 'track', 'video'], // NOTE: The `<picture>` element should not be in this list.
		nobrTags  : ['audio', 'colgroup', 'datalist', 'dl', 'figure', 'meter', 'ol', 'optgroup', 'picture', 'progress', 'ruby', 'select', 'table', 'tbody', 'tfoot', 'thead', 'tr', 'ul', 'video'],
		voidTags  : ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr'],

		handler(w) {
			const tagMatch = this.tagRe.exec(w.matchText);
			const tag      = tagMatch && tagMatch[1];
			const tagName  = tag && tag.toLowerCase();

			if (tagName) {
				const isVoid = this.voidTags.includes(tagName) || w.matchText.endsWith('/>');
				const isNobr = this.nobrTags.includes(tagName);
				let terminator;
				let terminatorMatch;

				if (!isVoid) {
					terminator = `<\\/${tagName}\\s*>`;

					const terminatorRe = new RegExp(terminator, 'gim'); // ignore case during match

					terminatorRe.lastIndex = w.matchStart;
					terminatorMatch = terminatorRe.exec(w.source);
				}

				if (isVoid || terminatorMatch) {
					let output    = w.output;
					let el        = document.createElement(w.output.tagName);
					let debugView;

					el.innerHTML = w.matchText;

					/*
						NOTE: The use of a `while` statement here is curious, however,
						I'm hesitant to change it for fear of breaking some edge case.
					*/
					while (el.firstChild) {
						el = el.firstChild;
					}

					try {
						this.processAttributeDirectives(el);
					}
					catch (ex) {
						return throwError(
							w.output,
							`<${tagName}>: ${ex.message}`,
							`${w.matchText}\u2026`
						);
					}

					if (el.hasAttribute('data-passage')) {
						this.processDataAttributes(el, tagName);

						// Debug view setup.
						if (Config.debug) {
							debugView = new DebugView(
								w.output,
								`html-${tagName}`,
								tagName,
								w.matchText
							);
							debugView.modes({
								block   : tagName === 'img',
								nonvoid : terminatorMatch
							});
							output = debugView.output;
						}
					}

					if (terminatorMatch) {
						/*
							NOTE: There's no catch clause here because this try/finally exists
							solely to ensure that the options stack is properly restored in
							the event that an uncaught exception is thrown during the call to
							`subWikify()`.
						*/
						try {
							Wikifier.Option.push({ nobr : isNobr });
							w.subWikify(el, terminator, { ignoreTerminatorCase : true });
						}
						finally {
							Wikifier.Option.pop();
						}

						/*
							Debug view modification.  If the current element has any debug
							view descendants who have "block" mode set, then set its debug
							view to the same.  It just makes things look a bit nicer.
						*/
						if (debugView && jQuery(el).find('.debug.block').length > 0) {
							debugView.modes({ block : true });
						}
					}

					/*
						NOTE: The use of `cloneNode(true)` here for `<track>` elements
						is necessary to workaround a poorly understood rehoming issue.
					*/
					output.appendChild(tagName === 'track' ? el.cloneNode(true) : el);
				}
				else {
					return throwError(
						w.output,
						`cannot find a closing tag for HTML <${tag}>`,
						`${w.matchText}\u2026`
					);
				}
			}
		},

		processAttributeDirectives(el) {
			// NOTE: The `.attributes` property yields a live collection, so we
			// must make a non-live copy of it as we will be adding and removing
			// members of said collection if any directives are found.
			[...el.attributes].forEach(({ name, value }) => {
				const evalShorthand = name[0] === '@';

				if (evalShorthand || name.startsWith('sc-eval:')) {
					const newName = name.slice(evalShorthand ? 1 : 8); // Remove eval directive prefix.

					if (newName === 'data-setter') {
						throw new Error(`evaluation directive is not allowed on the data-setter attribute: "${name}"`);
					}

					let result;

					// Evaluate the value as TwineScript.
					try {
						result = Scripting.evalTwineScript(value);
					}
					catch (ex) {
						throw new Error(`bad evaluation from attribute directive "${name}": ${ex.message}`);
					}

					// Assign the result to the new attribute and remove the old one.
					try {
						/*
							NOTE: Most browsers (ca. Nov 2017) have broken `setAttribute()`
							method implementations that throw on attribute names that start
							with, or contain, various symbols that are completely valid per
							the specification.  Thus this code could fail if the user chooses
							attribute names that, after removing the directive prefix, are
							unpalatable to `setAttribute()`.
						*/
						el.setAttribute(newName, result);
						el.removeAttribute(name);
					}
					catch (ex) {
						throw new Error(`cannot transform attribute directive "${name}" into attribute "${newName}"`);
					}
				}
			});
		},

		processDataAttributes(el, tagName) {
			let passage = el.getAttribute('data-passage');

			if (passage == null) { // lazy equality for null
				return;
			}

			const evaluated = Wikifier.helpers.evalPassageId(passage);

			if (evaluated !== passage) {
				passage = evaluated;
				el.setAttribute('data-passage', evaluated);
			}

			if (passage !== '') {
				// Media element, so attempt media passage transclusion.
				if (this.mediaTags.includes(tagName)) {
					if (passage.slice(0, 5) !== 'data:' && Story.has(passage)) {
						passage = Story.get(passage);

						let parentName;
						let twineTag;

						switch (tagName) {
						case 'audio':
						case 'video':
							twineTag = `Twine.${tagName}`;
							break;
						case 'img':
							twineTag = 'Twine.image';
							break;
						case 'track':
							twineTag = 'Twine.vtt';
							break;
						case 'source':
							{
								const $parent = $(el).closest('audio,picture,video');

								if ($parent.length) {
									parentName = $parent.get(0).tagName.toLowerCase();
									twineTag = `Twine.${parentName === 'picture' ? 'image' : parentName}`;
								}
							}
							break;
						}

						if (passage.tags.includes(twineTag)) {
							el[parentName === 'picture' ? 'srcset' : 'src'] = passage.text.trim();
						}
					}
				}

				// Elsewise, assume a link element of some type—e.g., '<a>', '<area>', '<button>', etc.
				else {
					let setter = el.getAttribute('data-setter');
					let setFn;

					if (setter != null) { // lazy equality for null
						setter = String(setter).trim();

						if (setter !== '') {
							setFn = Wikifier.helpers.createShadowSetterCallback(Scripting.parse(setter));
						}
					}

					if (Story.has(passage)) {
						el.classList.add('link-internal');

						if (Config.addVisitedLinkClass && State.hasPlayed(passage)) {
							el.classList.add('link-visited');
						}
					}
					else {
						el.classList.add('link-broken');
					}

					jQuery(el).ariaClick({ one : true }, function () {
						if (typeof setFn === 'function') {
							setFn.call(this);
						}

						Engine.play(passage);
					});
				}
			}
		}
	});
})();

/***********************************************************************************************************************

	markup/template.js

	Copyright © 2019–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Patterns */

var Template = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Template definitions.
	const _templates = new Map();

	// Valid template name regular expression.
	const _validNameRe = new RegExp(`^(?:${Patterns.templateName})$`);

	// Valid template type predicate.
	const _validType = template => {
		const templateType = typeof template;
		return templateType === 'function' || templateType === 'string';
	};


	/*******************************************************************************
		Template Functions.
	*******************************************************************************/

	function templateAdd(name, template) {
		if (
			   !_validType(template)
			&& !(template instanceof Array && template.length > 0 && template.every(_validType))
		) {
			throw new TypeError(`invalid template type (${name}); templates must be: functions, strings, or an array of either`);
		}

		(name instanceof Array ? name : [name]).forEach(name => {
			if (!_validNameRe.test(name)) {
				throw new Error(`invalid template name "${name}"`);
			}
			if (_templates.has(name)) {
				throw new Error(`cannot clobber existing template ?${name}`);
			}

			_templates.set(name, template);
		});
	}

	function templateDelete(name) {
		(name instanceof Array ? name : [name]).forEach(name => _templates.delete(name));
	}

	function templateGet(name) {
		return _templates.has(name) ? _templates.get(name) : null;
	}

	function templateHas(name) {
		return _templates.has(name);
	}

	function templateSize() {
		return _templates.size;
	}


	/*******************************************************************************
		Object Exports.
	*******************************************************************************/

	return Object.freeze(Object.defineProperties({}, {
		add    : { value : templateAdd },
		delete : { value : templateDelete },
		get    : { value : templateGet },
		has    : { value : templateHas },
		size   : { get : templateSize }
	}));
})();

/***********************************************************************************************************************

	macros/macro.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Patterns, Scripting, macros */

var Macro = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Macro definitions.
	const _macros = {};

	// Map of all macro tags and their parents (key: 'tag name' => value: ['list of parent names']).
	const _tags = {};

	// Valid macro name regular expression.
	const _validNameRe = new RegExp(`^(?:${Patterns.macroName})$`);


	/*******************************************************************************************************************
		Macros Functions.
	*******************************************************************************************************************/
	function macrosAdd(name, def) {
		if (Array.isArray(name)) {
			name.forEach(name => macrosAdd(name, def));
			return;
		}

		if (!_validNameRe.test(name)) {
			throw new Error(`invalid macro name "${name}"`);
		}

		if (macrosHas(name)) {
			throw new Error(`cannot clobber existing macro <<${name}>>`);
		}
		else if (tagsHas(name)) {
			throw new Error(`cannot clobber child tag <<${name}>> of parent macro${_tags[name].length === 1 ? '' : 's'} <<${_tags[name].join('>>, <<')}>>`);
		}

		try {
			if (typeof def === 'object') {
				// Add the macro definition.
				//
				// NOTE: Since `macrosGet()` may return legacy macros, we add the `_MACRO_API`
				// flag to (modern) API macros, so that the macro formatter will know how to
				// call the macro.  This should be removed in v3.
				_macros[name] = Object.assign(Object.create(null), def, { _MACRO_API : true });
			}
			else {
				// Add the macro alias.
				if (macrosHas(def)) {
					_macros[name] = Object.create(_macros[def], {
						_ALIAS_OF : {
							enumerable : true,
							value      : def
						}
					});
				}
				else {
					throw new Error(`cannot create alias of nonexistent macro <<${def}>>`);
				}
			}

			Object.defineProperty(_macros, name, { writable : false });
		}
		catch (ex) {
			if (ex.name === 'TypeError') {
				throw new Error(`cannot clobber protected macro <<${name}>>`);
			}
			else {
				throw new Error(`unknown error when attempting to add macro <<${name}>>: [${ex.name}] ${ex.message}`);
			}
		}

		// Tags post-processing.
		if (typeof _macros[name].tags !== 'undefined') {
			if (_macros[name].tags == null) { // lazy equality for null
				tagsRegister(name);
			}
			else if (Array.isArray(_macros[name].tags)) {
				tagsRegister(name, _macros[name].tags);
			}
			else {
				throw new Error(`bad value for "tags" property of macro <<${name}>>`);
			}
		}
	}

	function macrosDelete(name) {
		if (Array.isArray(name)) {
			name.forEach(name => macrosDelete(name));
			return;
		}

		if (macrosHas(name)) {
			// Tags pre-processing.
			if (typeof _macros[name].tags !== 'undefined') {
				tagsUnregister(name);
			}

			try {
				// Remove the macro definition.
				Object.defineProperty(_macros, name, { writable : true });
				delete _macros[name];
			}
			catch (ex) {
				throw new Error(`unknown error removing macro <<${name}>>: ${ex.message}`);
			}
		}
		else if (tagsHas(name)) {
			throw new Error(`cannot remove child tag <<${name}>> of parent macro <<${_tags[name]}>>`);
		}
	}

	function macrosIsEmpty() {
		return Object.keys(_macros).length === 0;
	}

	function macrosHas(name) {
		return _macros.hasOwnProperty(name);
	}

	function macrosGet(name) {
		let macro = null;

		if (macrosHas(name) && typeof _macros[name].handler === 'function') {
			macro = _macros[name];
		}
		/* legacy macro support */
		else if (macros.hasOwnProperty(name) && typeof macros[name].handler === 'function') {
			macro = macros[name];
		}
		/* /legacy macro support */

		return macro;
	}

	function macrosInit(handler = 'init') { // eslint-disable-line no-unused-vars
		Object.keys(_macros).forEach(name => {
			if (typeof _macros[name][handler] === 'function') {
				_macros[name][handler](name);
			}
		});

		/* legacy macro support */
		Object.keys(macros).forEach(name => {
			if (typeof macros[name][handler] === 'function') {
				macros[name][handler](name);
			}
		});
		/* /legacy macro support */
	}


	/*******************************************************************************************************************
		Tags Functions.
	*******************************************************************************************************************/
	function tagsRegister(parent, bodyTags) {
		if (!parent) {
			throw new Error('no parent specified');
		}

		const endTags = [`/${parent}`, `end${parent}`]; // automatically create the closing tags
		const allTags = [].concat(endTags, Array.isArray(bodyTags) ? bodyTags : []);

		for (let i = 0; i < allTags.length; ++i) {
			const tag = allTags[i];

			if (macrosHas(tag)) {
				throw new Error('cannot register tag for an existing macro');
			}

			if (tagsHas(tag)) {
				if (!_tags[tag].includes(parent)) {
					_tags[tag].push(parent);
					_tags[tag].sort();
				}
			}
			else {
				_tags[tag] = [parent];
			}
		}
	}

	function tagsUnregister(parent) {
		if (!parent) {
			throw new Error('no parent specified');
		}

		Object.keys(_tags).forEach(tag => {
			const i = _tags[tag].indexOf(parent);

			if (i !== -1) {
				if (_tags[tag].length === 1) {
					delete _tags[tag];
				}
				else {
					_tags[tag].splice(i, 1);
				}
			}
		});
	}

	function tagsHas(name) {
		return _tags.hasOwnProperty(name);
	}

	function tagsGet(name) {
		return tagsHas(name) ? _tags[name] : null;
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Macro Functions.
		*/
		add     : { value : macrosAdd },
		delete  : { value : macrosDelete },
		isEmpty : { value : macrosIsEmpty },
		has     : { value : macrosHas },
		get     : { value : macrosGet },
		init    : { value : macrosInit },

		/*
			Tags Functions.
		*/
		tags : {
			value : Object.freeze(Object.defineProperties({}, {
				register   : { value : tagsRegister },
				unregister : { value : tagsUnregister },
				has        : { value : tagsHas },
				get        : { value : tagsGet }
			}))
		},

		/*
			Legacy Aliases.
		*/
		evalStatements : { value : (...args) => Scripting.evalJavaScript(...args) } // SEE: `markup/scripting.js`.
	}));
})();

/***********************************************************************************************************************

	macros/macrocontext.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Config, DebugView, Patterns, State, Wikifier, throwError */

var MacroContext = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
		MacroContext Class.
	*******************************************************************************************************************/
	class MacroContext {
		constructor(contextData) {
			const context = Object.assign({
				parent      : null,
				macro       : null,
				name        : '',
				displayName : '',
				args        : null,
				payload     : null,
				parser      : null,
				source      : ''
			}, contextData);

			if (context.macro === null || context.name === '' || context.parser === null) {
				throw new TypeError('context object missing required properties');
			}

			Object.defineProperties(this, {
				self : {
					value : context.macro
				},

				name : {
					value : typeof context.macro._ALIAS_OF === 'undefined' ? context.name : context.macro._ALIAS_OF
				},

				displayName : {
					value : context.name
				},

				args : {
					value : context.args
				},

				payload : {
					value : context.payload
				},

				source : {
					value : context.source
				},

				parent : {
					value : context.parent
				},

				parser : {
					value : context.parser
				},

				_output : {
					value : context.parser.output
				},

				_shadows : {
					writable : true,
					value    : null
				},

				_debugView : {
					writable : true,
					value    : null
				},

				_debugViewEnabled : {
					writable : true,
					value    : Config.debug
				}
			});
		}

		get output() {
			return this._debugViewEnabled ? this.debugView.output : this._output;
		}

		get shadows() {
			return [...this._shadows];
		}

		get shadowView() {
			const view = new Set();
			this.contextSelectAll(ctx => ctx._shadows)
				.forEach(ctx => ctx._shadows.forEach(name => view.add(name)));
			return [...view];
		}

		get debugView() {
			if (this._debugViewEnabled) {
				return this._debugView !== null ? this._debugView : this.createDebugView();
			}

			return null;
		}

		contextHas(filter) {
			let context = this;

			while ((context = context.parent) !== null) {
				if (filter(context)) {
					return true;
				}
			}

			return false;
		}

		contextSelect(filter) {
			let context = this;

			while ((context = context.parent) !== null) {
				if (filter(context)) {
					return context;
				}
			}

			return null;
		}

		contextSelectAll(filter) {
			const result = [];
			let context = this;

			while ((context = context.parent) !== null) {
				if (filter(context)) {
					result.push(context);
				}
			}

			return result;
		}

		addShadow(...names) {
			if (!this._shadows) {
				this._shadows = new Set();
			}

			const varRe = new RegExp(`^${Patterns.variable}$`);

			names
				.flat(Infinity)
				.forEach(name => {
					if (typeof name !== 'string') {
						throw new TypeError(`variable name must be a string; type: ${typeof name}`);
					}

					if (!varRe.test(name)) {
						throw new Error(`invalid variable name "${name}"`);
					}

					this._shadows.add(name);
				});
		}

		createShadowWrapper(callback, doneCallback, startCallback) {
			const shadowContext = this;
			let shadowStore;

			if (typeof callback === 'function') {
				shadowStore = {};
				this.shadowView.forEach(varName => {
					const varKey = varName.slice(1);
					const store  = varName[0] === '$' ? State.variables : State.temporary;
					shadowStore[varName] = store[varKey];
				});
			}

			return function (...args) {
				if (typeof startCallback === 'function') {
					startCallback.apply(this, args);
				}

				if (typeof callback === 'function') {
					const shadowNames = Object.keys(shadowStore);
					const valueCache  = shadowNames.length > 0 ? {} : null;
					const macroParser = Wikifier.Parser.get('macro');
					let contextCache;

					/*
						There's no catch clause because this try/finally is here simply to ensure that
						proper cleanup is done in the event that an exception is thrown during the
						callback.
					*/
					try {
						/*
							Cache the existing values of the variables to be shadowed and assign the
							shadow values.
						*/
						shadowNames.forEach(varName => {
							const varKey = varName.slice(1);
							const store  = varName[0] === '$' ? State.variables : State.temporary;

							if (store.hasOwnProperty(varKey)) {
								valueCache[varKey] = store[varKey];
							}

							store[varKey] = shadowStore[varName];
						});

						// Cache the existing macro execution context and assign the shadow context.
						contextCache = macroParser.context;
						macroParser.context = shadowContext;

						// Call the callback function.
						callback.apply(this, args);
					}
					finally {
						// Revert the macro execution context shadowing.
						if (contextCache !== undefined) {
							macroParser.context = contextCache;
						}

						// Revert the variable shadowing.
						shadowNames.forEach(varName => {
							const varKey = varName.slice(1);
							const store  = varName[0] === '$' ? State.variables : State.temporary;

							/*
								Update the shadow store with the variable's current value, in case it
								was modified during the callback.
							*/
							shadowStore[varName] = store[varKey];

							if (valueCache.hasOwnProperty(varKey)) {
								store[varKey] = valueCache[varKey];
							}
							else {
								delete store[varKey];
							}
						});
					}
				}

				if (typeof doneCallback === 'function') {
					doneCallback.apply(this, args);
				}
			};
		}

		createDebugView(name, title) {
			this._debugView = new DebugView(
				this._output,
				'macro',
				name ? name : this.displayName,
				title ? title : this.source
			);

			if (this.payload !== null && this.payload.length > 0) {
				this._debugView.modes({ nonvoid : true });
			}

			this._debugViewEnabled = true;
			return this._debugView;
		}

		removeDebugView() {
			if (this._debugView !== null) {
				this._debugView.remove();
				this._debugView = null;
			}

			this._debugViewEnabled = false;
		}

		error(message, source, stack) {
			return throwError(this._output, `<<${this.displayName}>>: ${message}`, source ? source : this.source, stack);
		}
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return MacroContext;
})();

/***********************************************************************************************************************

	macros/macrolib.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/*
	global Config, DebugView, Engine, Has, L10n, Macro, NodeTyper, Patterns, Scripting, SimpleAudio, State,
	       Story, TempState, Util, Wikifier, postdisplay, prehistory, storage, stringFrom
*/

(() => {
	'use strict';

	/*******************************************************************************************************************
		Variables Macros.
	*******************************************************************************************************************/
	/*
		<<capture>>
	*/
	Macro.add('capture', {
		skipArgs : true,
		tags     : null,
		tsVarRe  : new RegExp(`(${Patterns.variable})`,'g'),

		handler() {
			if (this.args.raw.length === 0) {
				return this.error('no story/temporary variable list specified');
			}

			const valueCache = {};

			/*
				There's no catch clause because this try/finally is here simply to ensure that
				proper cleanup is done in the event that an exception is thrown during the
				`Wikifier` call.
			*/
			try {
				const tsVarRe = this.self.tsVarRe;
				let match;

				/*
					Cache the existing values of the variables and add a shadow.
				*/
				while ((match = tsVarRe.exec(this.args.raw)) !== null) {
					const varName = match[1];
					const varKey  = varName.slice(1);
					const store   = varName[0] === '$' ? State.variables : State.temporary;

					if (store.hasOwnProperty(varKey)) {
						valueCache[varKey] = store[varKey];
					}

					this.addShadow(varName);
				}

				new Wikifier(this.output, this.payload[0].contents);
			}
			finally {
				// Revert the variable shadowing.
				this.shadows.forEach(varName => {
					const varKey = varName.slice(1);
					const store  = varName[0] === '$' ? State.variables : State.temporary;

					if (valueCache.hasOwnProperty(varKey)) {
						store[varKey] = valueCache[varKey];
					}
					else {
						delete store[varKey];
					}
				});
			}
		}
	});

	/*
		<<set>>
	*/
	Macro.add('set', {
		skipArgs : true,

		handler() {
			if (this.args.full.length === 0) {
				return this.error('no expression specified');
			}

			try {
				Scripting.evalJavaScript(this.args.full);
			}
			catch (ex) {
				return this.error(`bad evaluation: ${typeof ex === 'object' ? `${ex.name}: ${ex.message}` : ex}`, null, ex.stack);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});

	/*
		<<unset>>
	*/
	Macro.add('unset', {
		skipArgs : true,

		handler() {
			if (this.args.full.length === 0) {
				return this.error('no story/temporary variable list specified');
			}

			const searchRe  = /[,;\s]*((?:State\.(?:variables|temporary)|setup)\.)/g;
			const replacer  = (_, p1) => `; delete ${p1}`;
			const cleanupRe = /^; /;

			try {
				const unsetExp = this.args.full.replace(searchRe, replacer).replace(cleanupRe, '');

				Scripting.evalJavaScript(unsetExp);
			}
			catch (ex) {
				return this.error(`bad evaluation: ${getErrorMessage(ex)}`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});

	/*
		<<remember>>
	*/
	Macro.add('remember', {
		skipArgs : true,
		jsVarRe  : new RegExp(`State\\.variables\\.(${Patterns.identifier})`, 'g'),

		handler() {
			if (this.args.full.length === 0) {
				return this.error('no expression specified');
			}

			try {
				Scripting.evalJavaScript(this.args.full);
			}
			catch (ex) {
				return this.error(`bad evaluation: ${typeof ex === 'object' ? ex.message : ex}`);
			}

			const remember = storage.get('remember') || {};
			const jsVarRe  = this.self.jsVarRe;
			let match;

			while ((match = jsVarRe.exec(this.args.full)) !== null) {
				const name = match[1];
				remember[name] = State.variables[name];
			}

			if (!storage.set('remember', remember)) {
				return this.error(`unknown error, cannot remember: ${this.args.raw}`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		},

		init() {
			const remember = storage.get('remember');

			if (remember) {
				Object.keys(remember).forEach(name => State.variables[name] = remember[name]);
			}
		}
	});

	/*
		<<forget>>
	*/
	Macro.add('forget', {
		skipArgs : true,
		jsVarRe  : new RegExp(`State\\.variables\\.(${Patterns.identifier})`, 'g'),

		handler() {
			if (this.args.full.length === 0) {
				return this.error('no story variable list specified');
			}

			const remember = storage.get('remember');
			const jsVarRe  = this.self.jsVarRe;
			let match;
			let needStore = false;

			while ((match = jsVarRe.exec(this.args.full)) !== null) {
				const name = match[1];

				if (State.variables.hasOwnProperty(name)) {
					delete State.variables[name];
				}

				if (remember && remember.hasOwnProperty(name)) {
					needStore = true;
					delete remember[name];
				}
			}

			if (needStore) {
				if (Object.keys(remember).length === 0) {
					if (!storage.delete('remember')) {
						return this.error('unknown error, cannot update remember store');
					}
				}
				else if (!storage.set('remember', remember)) {
					return this.error('unknown error, cannot update remember store');
				}
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});


	/*******************************************************************************************************************
		Scripting Macros.
	*******************************************************************************************************************/
	/*
		<<run>>
	*/
	Macro.add('run', 'set'); // add <<run>> as an alias of <<set>>

	/*
		<<script>>
	*/
	Macro.add('script', {
		skipArgs : true,
		tags     : null,

		handler() {
			const output = document.createDocumentFragment();

			try {
				Scripting.evalJavaScript(this.payload[0].contents, output);
			}
			catch (ex) {
				return this.error(`bad evaluation: ${typeof ex === 'object' ? ex.message : ex}`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.createDebugView();
			}

			if (output.hasChildNodes()) {
				this.output.appendChild(output);
			}
		}
	});


	/*******************************************************************************************************************
		Display Macros.
	*******************************************************************************************************************/
	/*
		<<include>>
	*/
	Macro.add('include', {
		handler() {
			if (this.args.length === 0) {
				return this.error('no passage specified');
			}

			let passage;

			if (typeof this.args[0] === 'object') {
				// Argument was in wiki link syntax.
				passage = this.args[0].link;
			}
			else {
				// Argument was simply the passage name.
				passage = this.args[0];
			}

			if (!Story.has(passage)) {
				return this.error(`passage "${passage}" does not exist`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			passage = Story.get(passage);
			let $el;

			if (this.args[1]) {
				$el = jQuery(document.createElement(this.args[1]))
					.addClass(`${passage.domId} macro-${this.name}`)
					.attr('data-passage', passage.title)
					.appendTo(this.output);
			}
			else {
				$el = jQuery(this.output);
			}

			$el.wiki(passage.processText());
		}
	});

	/*
		<<nobr>>
	*/
	Macro.add('nobr', {
		skipArgs : true,
		tags     : null,

		handler() {
			/*
				Wikify the contents, after removing all leading & trailing newlines and compacting
				all internal sequences of newlines into single spaces.
			*/
			new Wikifier(this.output, this.payload[0].contents.replace(/^\n+|\n+$/g, '').replace(/\n+/g, ' '));
		}
	});

	/*
		<<print>>, <<=>>, & <<->>
	*/
	Macro.add(['print', '=', '-'], {
		skipArgs : true,

		handler() {
			if (this.args.full.length === 0) {
				return this.error('no expression specified');
			}

			try {
				const result = stringFrom(Scripting.evalJavaScript(this.args.full));

				if (result !== null) {
					new Wikifier(this.output, this.name === '-' ? Util.escape(result) : result);
				}
			}
			catch (ex) {
				return this.error(`bad evaluation: ${typeof ex === 'object' ? `${ex.name}: ${ex.message}` : ex}`, null, ex.stack);
			}
		}
	});

	/*
		<<silently>>
	*/
	Macro.add('silently', {
		skipArgs : true,
		tags     : null,

		handler() {
			const frag = document.createDocumentFragment();
			new Wikifier(frag, this.payload[0].contents.trim());

			if (Config.debug) {
				// Custom debug view setup.
				this.debugView.modes({ block : true, hidden : true });
				this.output.appendChild(frag);
			}
			else {
				// Discard the output, unless there were errors.
				const errList = [...frag.querySelectorAll('.error')].map(errEl => errEl.textContent);

				if (errList.length > 0) {
					return this.error(`error${errList.length === 1 ? '' : 's'} within contents (${errList.join('; ')})`);
				}
			}
		}
	});

	/*
		<<type speed [start delay] [class classes] [element tag] [id ID] [keep|none] [skipkey key]>>
	*/
	Macro.add('type', {
		isAsync : true,
		tags    : null,
		typeId  : 0,

		handler() {
			if (this.args.length === 0) {
				return this.error('no speed specified');
			}

			const speed = Util.fromCssTime(this.args[0]); // in milliseconds

			if (speed < 0) {
				return this.error(`speed time value must be non-negative (received: ${this.args[0]})`);
			}

			let cursor;
			let elClass = '';
			let elId    = '';
			let elTag   = 'div';
			let skipKey = Config.macros.typeSkipKey;
			let start   = 400; // in milliseconds

			// Process optional arguments.
			const options = this.args.slice(1);

			while (options.length > 0) {
				const option = options.shift();

				switch (option) {
				case 'class': {
					if (options.length === 0) {
						return this.error('class option missing required class name(s)');
					}

					elClass = options.shift();

					if (elClass === '') {
						throw new Error('class option class name(s) must be non-empty (received: "")');
					}

					break;
				}

				case 'element': {
					if (options.length === 0) {
						return this.error('element option missing required element tag name');
					}

					elTag = options.shift();

					if (elTag === '') {
						throw new Error('element option tag name must be non-empty (received: "")');
					}

					break;
				}

				case 'id': {
					if (options.length === 0) {
						return this.error('id option missing required ID');
					}

					elId = options.shift();

					if (elId === '') {
						throw new Error('id option ID must be non-empty (received: "")');
					}

					break;
				}

				case 'keep':
					cursor = 'keep';
					break;

				case 'none':
					cursor = 'none';
					break;

				case 'skipkey': {
					if (options.length === 0) {
						return this.error('skipkey option missing required key value');
					}

					skipKey = options.shift();

					if (skipKey === '') {
						throw new Error('skipkey option key value must be non-empty (received: "")');
					}

					break;
				}

				case 'start': {
					if (options.length === 0) {
						return this.error('start option missing required time value');
					}

					const value = options.shift();
					start = Util.fromCssTime(value);

					if (start < 0) {
						throw new Error(`start option time value must be non-negative (received: ${value})`);
					}

					break;
				}

				default:
					return this.error(`unknown option: ${option}`);
				}
			}

			const contents = this.payload[0].contents;

			// Do nothing if there's no content to type out.
			if (contents.trim() === '') {
				return;
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			// Set up our base class name and event namespace.
			const className = `macro-${this.name}`;
			const namespace = `.${className}`;

			// Create a target to be later replaced by the typing wrapper.
			const $target = jQuery(document.createElement(elTag))
				.addClass(`${className} ${className}-target`)
				.appendTo(this.output);

			// Initialize the queue and clean up handlers.
			if (!TempState.macroTypeQueue) {
				// Set up the typing handler queue for all invocations.
				TempState.macroTypeQueue = [];

				// Immediately clear any existing handlers from our namespace and set up a
				// `:passageinit` event handler to clean up after navigation.
				$(document)
					.off(namespace)
					.one(`:passageinit${namespace}`, () => $(document).off(namespace));
			}

			// If the queue is empty at this point, set the start typing flag.
			const startTyping = TempState.macroTypeQueue.length === 0;

			// Generate our unique ID.
			const selfId = ++this.self.typeId;

			// Push our typing handler onto the queue.
			TempState.macroTypeQueue.push({
				id : selfId,

				handler() {
					const $wrapper = jQuery(document.createElement(elTag))
						.addClass(className);

					// Add the user ID, if any.
					if (elId) {
						$wrapper.attr('id', elId);
					}

					// Add the user class(es), if any.
					if (elClass) {
						$wrapper.addClass(elClass);
					}

					// Wikify the contents into `$wrapper`.
					new Wikifier($wrapper, contents);

					// Cache info about the current turn.
					const passage = State.passage;
					const turn    = State.turns;

					// Skip typing if….
					if (
						// …we've visited the passage before.
						!Config.macros.typeVisitedPassages
						&& State.passages.slice(0, -1).some(title => title === passage)

						// …there were any content errors.
						|| $wrapper.find('.error').length > 0
					) {
						$target.replaceWith($wrapper);

						// Remove this handler from the queue.
						TempState.macroTypeQueue.shift();

						// Run the next typing handler in the queue, if any.
						if (TempState.macroTypeQueue.length > 0) {
							TempState.macroTypeQueue.first().handler();
						}

						// Exit.
						return;
					}

					// Create a new `NodeTyper` instance for the wrapper's contents and
					// replace the target with the typing wrapper.
					const typer = new NodeTyper({
						targetNode : $wrapper.get(0),
						classNames : cursor === 'none' ? null : `${className}-cursor`
					});
					$target.replaceWith($wrapper);

					// Set up event IDs.
					const typingCompleteId = ':typingcomplete';
					const typingStartId    = ':typingstart';
					const typingStopId     = ':typingstop';
					const keydownAndNS     = `keydown${namespace}`;
					const typingStopAndNS  = `${typingStopId}${namespace}`;

					// Set up handlers for spacebar aborting and continuations.
					$(document)
						.off(keydownAndNS)
						.on(keydownAndNS, ev => {
							// Finish typing if the player aborts via the skip key.
							if (
								Util.scrubEventKey(ev.key) === skipKey
								&& (ev.target === document.body || ev.target === document.documentElement)
							) {
								ev.preventDefault();
								$(document).off(keydownAndNS);
								typer.finish();
							}
						})
						.one(typingStopAndNS, () => {
							if (TempState.macroTypeQueue) {
								// If the queue is empty, fire the typing complete event.
								if (TempState.macroTypeQueue.length === 0) {
									jQuery.event.trigger(typingCompleteId);
								}
								// Elsewise, run the next typing handler in the queue.
								else {
									TempState.macroTypeQueue.first().handler();
								}
							}
						});

					// Set up the typing interval and start/stop event firing.
					const typeNode = function typeNode() {
						const typeNodeMember = function typeNodeMember(typeIntervalId) {
							// Stop typing if….
							if (
								// …we've navigated away.
								State.passage !== passage
								|| State.turns !== turn

								// …we're done typing.
								|| !typer.type()
							) {
								// Terminate the timer, if it exists.
								if (typeIntervalId) {
									clearInterval(typeIntervalId);
								}

								// Remove this handler from the queue, if the queue still exists and the
								// handler IDs match.
								if (
									TempState.macroTypeQueue
									&& TempState.macroTypeQueue.length > 0
									&& TempState.macroTypeQueue.first().id === selfId
								) {
									TempState.macroTypeQueue.shift();
								}

								// Fire the typing stop event.
								$wrapper.trigger(typingStopId);

								// Add the done class to the wrapper.
								$wrapper.addClass(`${className}-done`);

								// Add the cursor class to the wrapper, if we're keeping it.
								if (cursor === 'keep') {
									$wrapper.addClass(`${className}-cursor`);
								}
							}
						};

						// Fire the typing start event.
						$wrapper.trigger(typingStartId);

						// Type the initial node member.
						typeNodeMember();

						// Set up the interval to continue typing.
						const typeNodeMemberId = setInterval(() => typeNodeMember(typeNodeMemberId), speed);
					};

					// Kick off typing the node.
					if (start) {
						setTimeout(typeNode, start);
					}
					else {
						typeNode();
					}
				}
			});

			// If we're to start typing, then either set up a `:passageend` event handler
			// to do so or start it immediately, depending on the engine state.
			if (startTyping) {
				if (Engine.isPlaying()) {
					$(document).one(`:passageend${namespace}`, () => TempState.macroTypeQueue.first().handler());
				}
				else {
					TempState.macroTypeQueue.first().handler();
				}
			}
		}
	});

	/*
		[DEPRECATED] <<display>>
	*/
	Macro.add('display', 'include'); // add <<display>> as an alias of <<include>>


	/*******************************************************************************************************************
		Control Macros.
	*******************************************************************************************************************/
	/*
		<<if>>, <<elseif>>, & <<else>>
	*/
	Macro.add('if', {
		skipArgs   : true,
		tags       : ['elseif', 'else'],
		elseifWsRe : /^\s*if\b/i,
		ifAssignRe : /[^!=&^|<>*/%+-]=[^=>]/,

		handler() {
			let i;

			try {
				const len = this.payload.length;

				// Sanity checks.
				const elseifWsRe = this.self.elseifWsRe;
				const ifAssignRe = this.self.ifAssignRe;

				for (/* declared previously */ i = 0; i < len; ++i) {
					/* eslint-disable prefer-template */
					switch (this.payload[i].name) {
					case 'else':
						if (this.payload[i].args.raw.length > 0) {
							if (elseifWsRe.test(this.payload[i].args.raw)) {
								return this.error(`whitespace is not allowed between the "else" and "if" in <<elseif>> clause${i > 0 ? ' (#' + i + ')' : ''}`);
							}

							return this.error(`<<else>> does not accept a conditional expression (perhaps you meant to use <<elseif>>), invalid: ${this.payload[i].args.raw}`);
						}

						if (i + 1 !== len) {
							return this.error('<<else>> must be the final clause');
						}
						break;

					default:
						if (this.payload[i].args.full.length === 0) {
							return this.error(`no conditional expression specified for <<${this.payload[i].name}>> clause${i > 0 ? ' (#' + i + ')' : ''}`);
						}
						else if (
							   Config.macros.ifAssignmentError
							&& ifAssignRe.test(this.payload[i].args.full)
						) {
							return this.error(`assignment operator found within <<${this.payload[i].name}>> clause${i > 0 ? ' (#' + i + ')' : ''} (perhaps you meant to use an equality operator: ==, ===, eq, is), invalid: ${this.payload[i].args.raw}`);
						}
						break;
					}
					/* eslint-enable prefer-template */
				}

				const evalJavaScript = Scripting.evalJavaScript;
				let success = false;

				// Evaluate the clauses.
				for (/* declared previously */ i = 0; i < len; ++i) {
					// Custom debug view setup for the current clause.
					if (Config.debug) {
						this
							.createDebugView(this.payload[i].name, this.payload[i].source)
							.modes({ nonvoid : false });
					}

					// Conditional test.
					if (this.payload[i].name === 'else' || !!evalJavaScript(this.payload[i].args.full)) {
						success = true;
						new Wikifier(this.output, this.payload[i].contents);
						break;
					}
					else if (Config.debug) {
						// Custom debug view setup for a failed conditional.
						this.debugView.modes({
							hidden  : true,
							invalid : true
						});
					}
				}

				// Custom debug view setup for the remaining clauses.
				if (Config.debug) {
					for (++i; i < len; ++i) {
						this
							.createDebugView(this.payload[i].name, this.payload[i].source)
							.modes({
								nonvoid : false,
								hidden  : true,
								invalid : true
							});
					}

					/*
						Fake a debug view for `<</if>>`.  We do this to aid the checking of nesting
						and as a quick indicator of if any of the clauses matched.
					*/
					this
						.createDebugView(`/${this.name}`, `<</${this.name}>>`)
						.modes({
							nonvoid : false,
							hidden  : !success,
							invalid : !success
						});
				}
			}
			catch (ex) {
				return this.error(`bad conditional expression in <<${i === 0 ? 'if' : 'elseif'}>> clause${i > 0 ? ' (#' + i + ')' : ''}: ${typeof ex === 'object' ? `${ex.name}: ${ex.message}` : ex}`, null, ex.stack); // eslint-disable-line prefer-template
			}
		}
	});

	/*
		<<switch>>, <<case>>, & <<default>>
	*/
	Macro.add('switch', {
		skipArgs : ['switch'],
		tags     : ['case', 'default'],

		handler() {
			if (this.args.full.length === 0) {
				return this.error('no expression specified');
			}

			const len = this.payload.length;

			// if (len === 1 || !this.payload.some(p => p.name === 'case')) {
			if (len === 1) {
				return this.error('no cases specified');
			}

			let i;

			// Sanity checks.
			for (/* declared previously */ i = 1; i < len; ++i) {
				switch (this.payload[i].name) {
				case 'default':
					if (this.payload[i].args.length > 0) {
						return this.error(`<<default>> does not accept values, invalid: ${this.payload[i].args.raw}`);
					}

					if (i + 1 !== len) {
						return this.error('<<default>> must be the final case');
					}
					break;

				default:
					if (this.payload[i].args.length === 0) {
						return this.error(`no value(s) specified for <<${this.payload[i].name}>> (#${i})`);
					}
					break;
				}
			}

			let result;

			try {
				result = Scripting.evalJavaScript(this.args.full);
			}
			catch (ex) {
				return this.error(`bad evaluation: ${typeof ex === 'object' ? ex.message : ex}`);
			}

			const debugView = this.debugView; // cache it now, to be modified later
			let success = false;

			// Initial debug view setup for `<<switch>>`.
			if (Config.debug) {
				debugView
					.modes({
						nonvoid : false,
						hidden  : true
					});
			}

			// Evaluate the clauses.
			for (/* declared previously */ i = 1; i < len; ++i) {
				// Custom debug view setup for the current case.
				if (Config.debug) {
					this
						.createDebugView(this.payload[i].name, this.payload[i].source)
						.modes({ nonvoid : false });
				}

				// Case test(s).
				if (this.payload[i].name === 'default' || this.payload[i].args.some(val => val === result)) {
					success = true;
					new Wikifier(this.output, this.payload[i].contents);
					break;
				}
				else if (Config.debug) {
					// Custom debug view setup for a failed case.
					this.debugView.modes({
						hidden  : true,
						invalid : true
					});
				}
			}

			// Custom debug view setup for the remaining cases.
			if (Config.debug) {
				for (++i; i < len; ++i) {
					this
						.createDebugView(this.payload[i].name, this.payload[i].source)
						.modes({
							nonvoid : false,
							hidden  : true,
							invalid : true
						});
				}

				/*
					Finalize the debug view for `<<switch>>` and fake a debug view for `<</switch>>`.
					We do both as a quick indicator of if any of the cases matched and the latter
					to aid the checking of nesting.
				*/
				debugView
					.modes({
						nonvoid : false,
						hidden  : true, // !success,
						invalid : !success
					});
				this
					.createDebugView(`/${this.name}`, `<</${this.name}>>`)
					.modes({
						nonvoid : false,
						hidden  : true, // !success,
						invalid : !success
					});
			}
		}
	});

	/*
		<<for>>, <<break>>, & <<continue>>
	*/
	Macro.add('for', {
		/* eslint-disable max-len */
		skipArgs    : true,
		tags        : null,
		hasRangeRe  : new RegExp(`^\\S${Patterns.anyChar}*?\\s+range\\s+\\S${Patterns.anyChar}*?$`),
		rangeRe     : new RegExp(`^(?:State\\.(variables|temporary)\\.(${Patterns.identifier})\\s*,\\s*)?State\\.(variables|temporary)\\.(${Patterns.identifier})\\s+range\\s+(\\S${Patterns.anyChar}*?)$`),
		threePartRe : /^([^;]*?)\s*;\s*([^;]*?)\s*;\s*([^;]*?)$/,
		forInRe     : /^\S+\s+in\s+\S+/i,
		forOfRe     : /^\S+\s+of\s+\S+/i,
		/* eslint-enable max-len */

		handler() {
			const argsStr = this.args.full.trim();
			const payload = this.payload[0].contents.replace(/\n$/, '');

			// Empty form.
			if (argsStr.length === 0) {
				this.self.handleFor.call(this, payload, null, true, null);
			}

			// Range form.
			else if (this.self.hasRangeRe.test(argsStr)) {
				const parts = argsStr.match(this.self.rangeRe);

				if (parts === null) {
					return this.error('invalid range form syntax, format: [index ,] value range collection');
				}

				this.self.handleForRange.call(
					this,
					payload,
					{ type : parts[1], name : parts[2] },
					{ type : parts[3], name : parts[4] },
					parts[5]
				);
			}

			// Conditional forms.
			else {
				let init;
				let condition;
				let post;

				// Conditional-only form.
				if (argsStr.indexOf(';') === -1) {
					// Sanity checks.
					if (this.self.forInRe.test(argsStr)) {
						return this.error('invalid syntax, for…in is not supported; see: for…range');
					}
					else if (this.self.forOfRe.test(argsStr)) {
						return this.error('invalid syntax, for…of is not supported; see: for…range');
					}

					condition = argsStr;
				}

				// 3-part conditional form.
				else {
					const parts = argsStr.match(this.self.threePartRe);

					if (parts === null) {
						return this.error('invalid 3-part conditional form syntax, format: [init] ; [condition] ; [post]');
					}

					init      = parts[1];
					condition = parts[2].trim();
					post      = parts[3];

					if (condition.length === 0) {
						condition = true;
					}
				}

				this.self.handleFor.call(this, payload, init, condition, post);
			}
		},

		handleFor(payload, init, condition, post) {
			const evalJavaScript = Scripting.evalJavaScript;
			let first  = true;
			let safety = Config.macros.maxLoopIterations;

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			try {
				TempState.break = null;

				if (init) {
					try {
						evalJavaScript(init);
					}
					catch (ex) {
						return this.error(`bad init expression: ${typeof ex === 'object' ? ex.message : ex}`);
					}
				}

				while (evalJavaScript(condition)) {
					if (Wikifier.stopWikify) return;

					if (--safety < 0) {
						return this.error(`exceeded configured maximum loop iterations (${Config.macros.maxLoopIterations})`);
					}

					new Wikifier(this.output, first ? payload.replace(/^\n/, '') : payload);

					if (first) {
						first = false;
					}

					if (TempState.break != null) { // lazy equality for null
						if (TempState.break === 1) {
							TempState.break = null;
						}
						else if (TempState.break === 2) {
							TempState.break = null;
							break;
						}
					}

					if (post) {
						try {
							evalJavaScript(post);
						}
						catch (ex) {
							return this.error(`bad post expression: ${typeof ex === 'object' ? ex.message : ex}`);
						}
					}
				}
			}
			catch (ex) {
				return this.error(`bad conditional expression: ${typeof ex === 'object' ? ex.message : ex}`);
			}
			finally {
				TempState.break = null;
			}
		},

		handleForRange(payload, indexVar, valueVar, rangeExp) {
			let first     = true;
			let rangeList;

			try {
				rangeList = this.self.toRangeList(rangeExp);
			}
			catch (ex) {
				return this.error(ex.message);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			try {
				TempState.break = null;

				for (let i = 0; i < rangeList.length; ++i) {
					if (indexVar.name) {
						State[indexVar.type][indexVar.name] = rangeList[i][0];
					}

					State[valueVar.type][valueVar.name] = rangeList[i][1];

					new Wikifier(this.output, first ? payload.replace(/^\n/, '') : payload);

					if (first) {
						first = false;
					}

					if (TempState.break != null) { // lazy equality for null
						if (TempState.break === 1) {
							TempState.break = null;
						}
						else if (TempState.break === 2) {
							TempState.break = null;
							break;
						}
					}
				}
			}
			catch (ex) {
				return this.error(typeof ex === 'object' ? ex.message : ex);
			}
			finally {
				TempState.break = null;
			}
		},

		toRangeList(rangeExp) {
			const evalJavaScript = Scripting.evalJavaScript;
			let value;

			try {
				/*
					NOTE: If the first character is the left curly brace, then we
					assume that it's part of an object literal and wrap it within
					parenthesis to ensure that it is not mistaken for a block
					during evaluation—which would cause an error.
				*/
				value = evalJavaScript(rangeExp[0] === '{' ? `(${rangeExp})` : rangeExp);
			}
			catch (ex) {
				if (typeof ex !== 'object') {
					throw new Error(`bad range expression: ${ex}`);
				}

				ex.message = `bad range expression: ${ex.message}`;
				throw ex;
			}

			let list;

			switch (typeof value) {
			case 'string':
				list = [];
				for (let i = 0; i < value.length; /* empty */) {
					const obj = Util.charAndPosAt(value, i);
					list.push([i, obj.char]);
					i = 1 + obj.end;
				}
				break;

			case 'object':
				if (Array.isArray(value)) {
					list = value.map((val, i) => [i, val]);
				}
				else if (value instanceof Set) {
					list = [...value].map((val, i) => [i, val]);
				}
				else if (value instanceof Map) {
					list = [...value.entries()];
				}
				else if (Util.toStringTag(value) === 'Object') {
					list = Object.keys(value).map(key => [key, value[key]]);
				}
				else {
					throw new Error(`unsupported range expression type: ${Util.toStringTag(value)}`);
				}
				break;

			default:
				throw new Error(`unsupported range expression type: ${typeof value}`);
			}

			return list;
		}
	});
	Macro.add(['break', 'continue'], {
		skipArgs : true,

		handler() {
			if (this.contextHas(ctx => ctx.name === 'for')) {
				TempState.break = this.name === 'continue' ? 1 : 2;
			}
			else {
				return this.error('must only be used in conjunction with its parent macro <<for>>');
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});


	/*******************************************************************************************************************
		Interactive Macros.
	*******************************************************************************************************************/
	/*
		<<button>> & <<link>>
	*/
	Macro.add(['button', 'link'], {
		isAsync : true,
		tags    : null,

		handler() {
			if (this.args.length === 0) {
				return this.error(`no ${this.name === 'button' ? 'button' : 'link'} text specified`);
			}

			const $link = jQuery(document.createElement(this.name === 'button' ? 'button' : 'a'));
			let passage;

			if (typeof this.args[0] === 'object') {
				if (this.args[0].isImage) {
					// Argument was in wiki image syntax.
					const $image = jQuery(document.createElement('img'))
						.attr('src', this.args[0].source)
						.appendTo($link);

					$link.addClass('link-image');

					if (this.args[0].hasOwnProperty('passage')) {
						$image.attr('data-passage', this.args[0].passage);
					}

					if (this.args[0].hasOwnProperty('title')) {
						$image.attr('title', this.args[0].title);
					}

					if (this.args[0].hasOwnProperty('align')) {
						$image.attr('align', this.args[0].align);
					}

					passage = this.args[0].link;
				}
				else {
					// Argument was in wiki link syntax.
					$link.append(document.createTextNode(this.args[0].text));
					passage = this.args[0].link;
				}
			}
			else {
				// Argument was simply the link text.
				$link.wikiWithOptions({ profile : 'core' }, this.args[0]);
				passage = this.args.length > 1 ? this.args[1] : undefined;
			}

			if (passage != null) { // lazy equality for null
				$link.attr('data-passage', passage);

				if (Story.has(passage)) {
					$link.addClass('link-internal');

					if (Config.addVisitedLinkClass && State.hasPlayed(passage)) {
						$link.addClass('link-visited');
					}
				}
				else {
					$link.addClass('link-broken');
				}
			}
			else {
				$link.addClass('link-internal');
			}

			$link
				.addClass(`macro-${this.name}`)
				.ariaClick({
					namespace : '.macros',
					role      : passage != null ? 'link' : 'button', // lazy equality for null
					one       : passage != null // lazy equality for null
				}, this.createShadowWrapper(
					this.payload[0].contents !== ''
						? () => Wikifier.wikifyEval(this.payload[0].contents.trim())
						: null,
					passage != null // lazy equality for null
						? () => Engine.play(passage)
						: null
				))
				.appendTo(this.output);
		}
	});

	/*
		<<checkbox>>
	*/
	Macro.add('checkbox', {
		isAsync : true,

		handler() {
			if (this.args.length < 3) {
				const errors = [];
				if (this.args.length < 1) { errors.push('variable name'); }
				if (this.args.length < 2) { errors.push('unchecked value'); }
				if (this.args.length < 3) { errors.push('checked value'); }
				return this.error(`no ${errors.join(' or ')} specified`);
			}

			// Ensure that the variable name argument is a string.
			if (typeof this.args[0] !== 'string') {
				return this.error('variable name argument is not a string');
			}

			const varName = this.args[0].trim();

			// Try to ensure that we receive the variable's name (incl. sigil), not its value.
			if (varName[0] !== '$' && varName[0] !== '_') {
				return this.error(`variable name "${this.args[0]}" is missing its sigil ($ or _)`);
			}

			const varId        = Util.slugify(varName);
			const uncheckValue = this.args[1];
			const checkValue   = this.args[2];
			const el           = document.createElement('input');

			/*
				Set up and append the input element to the output buffer.
			*/
			jQuery(el)
				.attr({
					id       : `${this.name}-${varId}`,
					name     : `${this.name}-${varId}`,
					type     : 'checkbox',
					tabindex : 0 // for accessiblity
				})
				.addClass(`macro-${this.name}`)
				.on('change.macros', this.createShadowWrapper(function () {
					State.setVar(varName, this.checked ? checkValue : uncheckValue);
				}))
				.appendTo(this.output);

			/*
				Set the variable and input element to the appropriate value and state, as requested.
			*/
			switch (this.args[3]) {
			case 'autocheck':
				if (State.getVar(varName) === checkValue) {
					el.checked = true;
				}
				else {
					State.setVar(varName, uncheckValue);
				}
				break;
			case 'checked':
				el.checked = true;
				State.setVar(varName, checkValue);
				break;
			default:
				State.setVar(varName, uncheckValue);
				break;
			}
		}
	});

	/*
		<<cycle>>, <<listbox>>, <<option>>, & <<optionsfrom>>
	*/
	Macro.add(['cycle', 'listbox'], {
		isAsync  : true,
		skipArgs : ['optionsfrom'],
		tags     : ['option', 'optionsfrom'],

		handler() {
			if (this.args.length === 0) {
				return this.error('no variable name specified');
			}

			// Ensure that the variable name argument is a string.
			if (typeof this.args[0] !== 'string') {
				return this.error('variable name argument is not a string');
			}

			const varName = this.args[0].trim();

			// Try to ensure that we receive the variable's name (incl. sigil), not its value.
			if (varName[0] !== '$' && varName[0] !== '_') {
				return this.error(`variable name "${this.args[0]}" is missing its sigil ($ or _)`);
			}

			const varId = Util.slugify(varName);
			const len   = this.payload.length;

			if (len === 1) {
				return this.error('no options specified');
			}

			const config = {
				autoselect : false,
				once       : false
			};

			// Process arguments.
			for (let i = 1; i < this.args.length; ++i) {
				const arg = this.args[i];

				switch (arg) {
				case 'once':       config.once = true; break;
				case 'autoselect': config.autoselect = true; break;
				default:           return this.error(`unknown argument: ${arg}`);
				}
			}

			const options    = [];
			const tagCount   = { option : 0, optionsfrom : 0 };
			let selectedIdx = -1;

			// Get the options and selected index, if any.
			for (let i = 1; i < len; ++i) {
				const payload = this.payload[i];

				// <<option label value [selected]>>
				if (payload.name === 'option') {
					++tagCount.option;

					if (payload.args.length === 0) {
						return this.error(`no arguments specified for <<${payload.name}>> (#${tagCount.option})`);
					}

					const option = { label : String(payload.args[0]) };
					let isSelected = false;

					switch (payload.args.length) {
					case 1:
						option.value = payload.args[0];
						break;

					case 2:
						if (payload.args[1] === 'selected') {
							option.value = payload.args[0];
							isSelected = true;
						}
						else {
							option.value = payload.args[1];
						}
						break;

					default:
						option.value = payload.args[1];

						if (payload.args[2] === 'selected') {
							isSelected = true;
						}
						break;
					}

					options.push(option);

					if (isSelected) {
						if (config.autoselect) {
							return this.error('cannot specify both the autoselect and selected keywords');
						}
						else if (selectedIdx !== -1) {
							return this.error(`multiple selected keywords specified for <<${payload.name}>> (#${selectedIdx + 1} & #${tagCount.option})`);
						}

						selectedIdx = options.length - 1;
					}
				}

				// <<optionsfrom expression>>
				else {
					++tagCount.optionsfrom;

					if (payload.args.full.length === 0) {
						return this.error(`no expression specified for <<${payload.name}>> (#${tagCount.optionsfrom})`);
					}

					let result;

					try {
						/*
							NOTE: If the first character is the left curly brace, then we
							assume that it's part of an object literal and wrap it within
							parenthesis to ensure that it is not mistaken for a block
							during evaluation—which would cause an error.
						*/
						const exp = payload.args.full;
						result = Scripting.evalJavaScript(exp[0] === '{' ? `(${exp})` : exp);
					}
					catch (ex) {
						return this.error(`bad evaluation: ${typeof ex === 'object' ? ex.message : ex}`);
					}

					if (typeof result !== 'object' || result === null) {
						return this.error(`expression must yield a supported collection or generic object (type: ${result === null ? 'null' : typeof result})`);
					}

					if (result instanceof Array || result instanceof Set) {
						result.forEach(val => options.push({ label : String(val), value : val }));
					}
					else if (result instanceof Map) {
						result.forEach((val, key) => options.push({ label : String(key), value : val }));
					}
					else {
						const oType = Util.toStringTag(result);

						if (oType !== 'Object') {
							return this.error(`expression must yield a supported collection or generic object (object type: ${oType})`);
						}

						Object.keys(result).forEach(key => options.push({ label : key, value : result[key] }));
					}
				}
			}

			// No options were selected by the user, so we must select one.
			if (selectedIdx === -1) {
				// Attempt to automatically select an option by matching the variable's current value.
				if (config.autoselect) {
					// NOTE: This will usually fail for objects due to a variety of reasons.
					const sameValueZero = Util.sameValueZero;
					const curValue      = State.getVar(varName);
					const curValueIdx   = options.findIndex(opt => sameValueZero(opt.value, curValue));
					selectedIdx = curValueIdx === -1 ? 0 : curValueIdx;
				}

				// Simply select the first option.
				else {
					selectedIdx = 0;
				}
			}

			// Set up and append the appropriate element to the output buffer.
			if (this.name === 'cycle') {
				const lastIdx = options.length - 1;

				if (config.once && selectedIdx === lastIdx) {
					jQuery(this.output)
						.wikiWithOptions({ profile : 'core' }, options[selectedIdx].label);
				}
				else {
					let cycleIdx = selectedIdx;
					jQuery(document.createElement('a'))
						.wikiWithOptions({ profile : 'core' }, options[selectedIdx].label)
						.attr('id', `${this.name}-${varId}`)
						.addClass(`macro-${this.name}`)
						.ariaClick({
							namespace : '.macros',
							role      : 'button'
						}, this.createShadowWrapper(function () {
							const $this = $(this);
							cycleIdx = (cycleIdx + 1) % options.length;
							State.setVar(varName, options[cycleIdx].value);
							$this.empty().wikiWithOptions({ profile : 'core' }, options[cycleIdx].label);

							if (config.once && cycleIdx === lastIdx) {
								$this.off().contents().unwrap();
							}
						}))
						.appendTo(this.output);
				}
			}
			else { // this.name === 'listbox'
				const $select = jQuery(document.createElement('select'));

				options.forEach((opt, i) => {
					jQuery(document.createElement('option'))
						.val(i)
						.text(opt.label)
						.appendTo($select);
				});

				$select
					.attr({
						id       : `${this.name}-${varId}`,
						name     : `${this.name}-${varId}`,
						tabindex : 0 // for accessiblity
					})
					.addClass(`macro-${this.name}`)
					.val(selectedIdx)
					.on('change.macros', this.createShadowWrapper(function () {
						State.setVar(varName, options[Number(this.value)].value);
					}))
					.appendTo(this.output);
			}

			// Set the variable to the appropriate value, as requested.
			State.setVar(varName, options[selectedIdx].value);
		}
	});

	/*
		<<linkappend>>, <<linkprepend>>, & <<linkreplace>>
	*/
	Macro.add(['linkappend', 'linkprepend', 'linkreplace'], {
		isAsync : true,
		tags    : null,
		t8nRe   : /^(?:transition|t8n)$/,

		handler() {
			if (this.args.length === 0) {
				return this.error('no link text specified');
			}

			const $link      = jQuery(document.createElement('a'));
			const $insert    = jQuery(document.createElement('span'));
			const transition = this.args.length > 1 && this.self.t8nRe.test(this.args[1]);

			$link
				.wikiWithOptions({ profile : 'core' }, this.args[0])
				.addClass(`link-internal macro-${this.name}`)
				.ariaClick({
					namespace : '.macros',
					one       : true
				}, this.createShadowWrapper(
					() => {
						if (this.name === 'linkreplace') {
							$link.remove();
						}
						else {
							$link
								.wrap(`<span class="macro-${this.name}"></span>`)
								.replaceWith(() => $link.html());
						}

						if (this.payload[0].contents !== '') {
							const frag = document.createDocumentFragment();
							new Wikifier(frag, this.payload[0].contents);
							$insert.append(frag);
						}

						if (transition) {
							setTimeout(() => $insert.removeClass(`macro-${this.name}-in`), Engine.minDomActionDelay);
						}
						// as adding and replacing content might add or change links, auto-regenerating the hotkeys might be needed
						Links.generate();
					}
				))
				.appendTo(this.output);

			$insert.addClass(`macro-${this.name}-insert`);

			if (transition) {
				$insert.addClass(`macro-${this.name}-in`);
			}

			if (this.name === 'linkprepend') {
				$insert.insertBefore($link);
			}
			else {
				$insert.insertAfter($link);
			}
		}
	});

	/*
		<<numberbox>> & <<textbox>>
	*/
	Macro.add(['numberbox', 'textbox'], {
		isAsync : true,

		handler() {
			if (this.args.length < 2) {
				const errors = [];
				if (this.args.length < 1) { errors.push('variable name'); }
				if (this.args.length < 2) { errors.push('default value'); }
				return this.error(`no ${errors.join(' or ')} specified`);
			}

			// Ensure that the variable name argument is a string.
			if (typeof this.args[0] !== 'string') {
				return this.error('variable name argument is not a string');
			}

			const varName = this.args[0].trim();

			// Try to ensure that we receive the variable's name (incl. sigil), not its value.
			if (varName[0] !== '$' && varName[0] !== '_') {
				return this.error(`variable name "${this.args[0]}" is missing its sigil ($ or _)`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			const asNumber     = this.name === 'numberbox';
			const defaultValue = asNumber ? Number(this.args[1]) : this.args[1];

			if (asNumber && Number.isNaN(defaultValue)) {
				return this.error(`default value "${this.args[1]}" is neither a number nor can it be parsed into a number`);
			}

			const varId = Util.slugify(varName);
			const el    = document.createElement('input');
			let autofocus = false;
			let passage;

			if (this.args.length > 3) {
				passage   = this.args[2];
				autofocus = this.args[3] === 'autofocus';
			}
			else if (this.args.length > 2) {
				if (this.args[2] === 'autofocus') {
					autofocus = true;
				}
				else {
					passage = this.args[2];
				}
			}

			if (typeof passage === 'object') {
				// Argument was in wiki link syntax.
				passage = passage.link;
			}

			// Set up and append the input element to the output buffer.
			jQuery(el)
				.attr({
					id        : `${this.name}-${varId}`,
					name      : `${this.name}-${varId}`,
					type      : asNumber ? 'number' : 'text',
					inputmode : asNumber ? 'decimal' : 'text',
					tabindex  : 0 // for accessiblity
				})
				.addClass(`macro-${this.name}`)
				.on('change.macros', this.createShadowWrapper(function () {
					State.setVar(varName, asNumber ? Number(this.value) : this.value);
				}))
				.on('keypress.macros', this.createShadowWrapper(function (ev) {
					// If Return/Enter is pressed, set the variable and, optionally, forward to another passage.
					if (ev.which === 13) { // 13 is Return/Enter
						ev.preventDefault();
						State.setVar(varName, asNumber ? Number(this.value) : this.value);

						if (passage != null) { // lazy equality for null
							Engine.play(passage);
						}
					}
				}))
				.appendTo(this.output);

			// Set the step value for `<input type="number">`.
			if (asNumber) {
				el.step = 'any';
			}

			// Set the variable and input element to the default value.
			State.setVar(varName, defaultValue);
			el.value = defaultValue;

			// Autofocus the input element, if requested.
			if (autofocus) {
				// Set the element's "autofocus" attribute.
				el.setAttribute('autofocus', 'autofocus');

				// Set up a single-use post-display task to autofocus the element.
				postdisplay[`#autofocus:${el.id}`] = task => {
					delete postdisplay[task]; // single-use task
					setTimeout(() => el.focus(), Engine.minDomActionDelay);
				};
			}
		}
	});

	/*
		<<radiobutton>>
	*/
	Macro.add('radiobutton', {
		isAsync : true,

		handler() {
			if (this.args.length < 2) {
				const errors = [];
				if (this.args.length < 1) { errors.push('variable name'); }
				if (this.args.length < 2) { errors.push('checked value'); }
				return this.error(`no ${errors.join(' or ')} specified`);
			}

			// Ensure that the variable name argument is a string.
			if (typeof this.args[0] !== 'string') {
				return this.error('variable name argument is not a string');
			}

			const varName = this.args[0].trim();

			// Try to ensure that we receive the variable's name (incl. sigil), not its value.
			if (varName[0] !== '$' && varName[0] !== '_') {
				return this.error(`variable name "${this.args[0]}" is missing its sigil ($ or _)`);
			}

			const varId      = Util.slugify(varName);
			const checkValue = this.args[1];
			const el         = document.createElement('input');

			/*
				Set up and initialize the group counter.
			*/
			if (!TempState.hasOwnProperty(this.name)) {
				TempState[this.name] = {};
			}

			if (!TempState[this.name].hasOwnProperty(varId)) {
				TempState[this.name][varId] = 0;
			}

			/*
				Set up and append the input element to the output buffer.
			*/
			jQuery(el)
				.attr({
					id       : `${this.name}-${varId}-${TempState[this.name][varId]++}`,
					name     : `${this.name}-${varId}`,
					type     : 'radio',
					tabindex : 0 // for accessiblity
				})
				.addClass(`macro-${this.name}`)
				.on('change.macros', this.createShadowWrapper(function () {
					if (this.checked) {
						State.setVar(varName, checkValue);
					}
				}))
				.appendTo(this.output);

			/*
				Set the variable to the checked value and the input element to checked, if requested.
			*/
			switch (this.args[2]) {
			case 'autocheck':
				if (State.getVar(varName) === checkValue) {
					el.checked = true;
				}
				break;
			case 'checked':
				el.checked = true;
				State.setVar(varName, checkValue);
				break;
			}
		}
	});

	/*
		<<textarea>>
	*/
	Macro.add('textarea', {
		isAsync : true,

		handler() {
			if (this.args.length < 2) {
				const errors = [];
				if (this.args.length < 1) { errors.push('variable name'); }
				if (this.args.length < 2) { errors.push('default value'); }
				return this.error(`no ${errors.join(' or ')} specified`);
			}

			// Ensure that the variable name argument is a string.
			if (typeof this.args[0] !== 'string') {
				return this.error('variable name argument is not a string');
			}

			const varName = this.args[0].trim();

			// Try to ensure that we receive the variable's name (incl. sigil), not its value.
			if (varName[0] !== '$' && varName[0] !== '_') {
				return this.error(`variable name "${this.args[0]}" is missing its sigil ($ or _)`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			const varId        = Util.slugify(varName);
			const defaultValue = this.args[1];
			const autofocus    = this.args[2] === 'autofocus';
			const el           = document.createElement('textarea');

			/*
				Set up and append the textarea element to the output buffer.
			*/
			jQuery(el)
				.attr({
					id       : `${this.name}-${varId}`,
					name     : `${this.name}-${varId}`,
					rows     : 4,
					// cols     : 68, // instead of setting "cols" we set the `min-width` in CSS
					tabindex : 0 // for accessiblity
				})
				.addClass(`macro-${this.name}`)
				.on('change.macros', this.createShadowWrapper(function () {
					State.setVar(varName, this.value);
				}))
				.appendTo(this.output);

			/*
				Set the variable and textarea element to the default value.
			*/
			State.setVar(varName, defaultValue);
			// Ideally, we should be setting `.defaultValue` here, but IE doesn't support it,
			// so we have to use `.textContent`, which is equivalent.
			el.textContent = defaultValue;

			/*
				Autofocus the textarea element, if requested.
			*/
			if (autofocus) {
				// Set the element's "autofocus" attribute.
				el.setAttribute('autofocus', 'autofocus');

				// Set up a single-use post-display task to autofocus the element.
				postdisplay[`#autofocus:${el.id}`] = task => {
					delete postdisplay[task]; // single-use task
					setTimeout(() => el.focus(), Engine.minDomActionDelay);
				};
			}
		}
	});

	/*
		[DEPRECATED] <<click>>
	*/
	Macro.add('click', 'link'); // add <<click>> as an alias of <<link>>


	/*******************************************************************************************************************
		Links Macros.
	*******************************************************************************************************************/
	/*
		<<actions>>
	*/
	Macro.add('actions', {
		handler() {
			const $list = jQuery(document.createElement('ul'))
				.addClass(this.name)
				.appendTo(this.output);

			for (let i = 0; i < this.args.length; ++i) {
				let passage;
				let text;
				let $image;
				let setFn;

				if (typeof this.args[i] === 'object') {
					if (this.args[i].isImage) {
						// Argument was in wiki image syntax.
						$image = jQuery(document.createElement('img'))
							.attr('src', this.args[i].source);

						if (this.args[i].hasOwnProperty('passage')) {
							$image.attr('data-passage', this.args[i].passage);
						}

						if (this.args[i].hasOwnProperty('title')) {
							$image.attr('title', this.args[i].title);
						}

						if (this.args[i].hasOwnProperty('align')) {
							$image.attr('align', this.args[i].align);
						}

						passage = this.args[i].link;
						setFn   = this.args[i].setFn;
					}
					else {
						// Argument was in wiki link syntax.
						text    = this.args[i].text;
						passage = this.args[i].link;
						setFn   = this.args[i].setFn;
					}
				}
				else {
					// Argument was simply the passage name.
					text = passage = this.args[i];
				}

				if (
					   State.variables.hasOwnProperty('#actions')
					&& State.variables['#actions'].hasOwnProperty(passage)
					&& State.variables['#actions'][passage]
				) {
					continue;
				}

				const $link = jQuery(Wikifier.createInternalLink(
					jQuery(document.createElement('li')).appendTo($list),
					passage,
					null,
					((passage, fn) => () => {
						if (!State.variables.hasOwnProperty('#actions')) {
							State.variables['#actions'] = {};
						}

						State.variables['#actions'][passage] = true;

						if (typeof fn === 'function') {
							fn();
						}
					})(passage, setFn)
				))
					.addClass(`macro-${this.name}`)
					.append($image || document.createTextNode(text));

				if ($image) {
					$link.addClass('link-image');
				}
			}
		}
	});

	/*
		<<back>> & <<return>>
	*/
	Macro.add(['back', 'return'], {
		handler() {
			/* legacy */
			if (this.args.length > 1) {
				return this.error('too many arguments specified, check the documentation for details');
			}
			/* /legacy */

			let momentIndex = -1;
			let passage;
			let text;
			let $image;

			if (this.args.length === 1) {
				if (typeof this.args[0] === 'object') {
					if (this.args[0].isImage) {
						// Argument was in wiki image syntax.
						$image = jQuery(document.createElement('img'))
							.attr('src', this.args[0].source);

						if (this.args[0].hasOwnProperty('passage')) {
							$image.attr('data-passage', this.args[0].passage);
						}

						if (this.args[0].hasOwnProperty('title')) {
							$image.attr('title', this.args[0].title);
						}

						if (this.args[0].hasOwnProperty('align')) {
							$image.attr('align', this.args[0].align);
						}

						if (this.args[0].hasOwnProperty('link')) {
							passage = this.args[0].link;
						}
					}
					else {
						// Argument was in wiki link syntax.
						if (this.args[0].count === 1) {
							// Simple link syntax: `[[...]]`.
							passage = this.args[0].link;
						}
						else {
							// Pretty link syntax: `[[...|...]]`.
							text    = this.args[0].text;
							passage = this.args[0].link;
						}
					}
				}
				else if (this.args.length === 1) {
					// Argument was simply the link text.
					text = this.args[0];
				}
			}

			if (passage == null) { // lazy equality for null
				/*
					Find the index and title of the most recent moment whose title does not match
					that of the active (present) moment's.
				*/
				for (let i = State.length - 2; i >= 0; --i) {
					if (State.history[i].title !== State.passage) {
						momentIndex = i;
						passage = State.history[i].title;
						break;
					}
				}

				// If we failed to find a passage and we're `<<return>>`, fallback to `State.expired`.
				if (passage == null && this.name === 'return') { // lazy equality for null
					for (let i = State.expired.length - 1; i >= 0; --i) {
						if (State.expired[i] !== State.passage) {
							passage = State.expired[i];
							break;
						}
					}
				}
			}
			else {
				if (!Story.has(passage)) {
					return this.error(`passage "${passage}" does not exist`);
				}

				if (this.name === 'back') {
					/*
						Find the index of the most recent moment whose title matches that of the
						specified passage.
					*/
					for (let i = State.length - 2; i >= 0; --i) {
						if (State.history[i].title === passage) {
							momentIndex = i;
							break;
						}
					}

					if (momentIndex === -1) {
						return this.error(`cannot find passage "${passage}" in the current story history`);
					}
				}
			}

			if (passage == null) { // lazy equality for null
				return this.error('cannot find passage');
			}

			// if (this.name === "back" && momentIndex === -1) {
			// 	// no-op; we're already at the first passage in the current story history
			// 	return;
			// }

			let $link;

			if (this.name !== 'back' || momentIndex !== -1) {
				$link = jQuery(document.createElement('a'))
					.addClass('link-internal')
					.ariaClick(
						{ one : true },
						this.name === 'return'
							? () => Engine.play(passage)
							: () => Engine.goTo(momentIndex)
					);

				if ($image) {
					$link.addClass('link-image');
				}
			}
			else {
				$link = jQuery(document.createElement('span'))
					.addClass('link-disabled');
			}

			$link
				.addClass(`macro-${this.name}`)
				.append($image || document.createTextNode(text || L10n.get(`macro${this.name.toUpperFirst()}Text`)))
				.appendTo(this.output);
		}
	});

	/*
		<<choice>>
	*/
	Macro.add('choice', {
		handler() {
			if (this.args.length === 0) {
				return this.error('no passage specified');
			}

			const choiceId = State.passage;
			let passage;
			let text;
			let $image;
			let setFn;

			if (this.args.length === 1) {
				if (typeof this.args[0] === 'object') {
					if (this.args[0].isImage) {
						// Argument was in wiki image syntax.
						$image = jQuery(document.createElement('img'))
							.attr('src', this.args[0].source);

						if (this.args[0].hasOwnProperty('passage')) {
							$image.attr('data-passage', this.args[0].passage);
						}

						if (this.args[0].hasOwnProperty('title')) {
							$image.attr('title', this.args[0].title);
						}

						if (this.args[0].hasOwnProperty('align')) {
							$image.attr('align', this.args[0].align);
						}

						passage = this.args[0].link;
						setFn   = this.args[0].setFn;
					}
					else {
						// Argument was in wiki link syntax.
						text    = this.args[0].text;
						passage = this.args[0].link;
						setFn   = this.args[0].setFn;
					}
				}
				else {
					// Argument was simply the passage name.
					text = passage = this.args[0];
				}
			}
			else {
				// NOTE: The arguments here are backwards.
				passage = this.args[0];
				text    = this.args[1];
			}

			let $link;

			if (
				   State.variables.hasOwnProperty('#choice')
				&& State.variables['#choice'].hasOwnProperty(choiceId)
				&& State.variables['#choice'][choiceId]
			) {
				$link = jQuery(document.createElement('span'))
					.addClass(`link-disabled macro-${this.name}`)
					.attr('tabindex', -1)
					.append($image || document.createTextNode(text))
					.appendTo(this.output);

				if ($image) {
					$link.addClass('link-image');
				}

				return;
			}

			$link = jQuery(Wikifier.createInternalLink(this.output, passage, null, () => {
				if (!State.variables.hasOwnProperty('#choice')) {
					State.variables['#choice'] = {};
				}

				State.variables['#choice'][choiceId] = true;

				if (typeof setFn === 'function') {
					setFn();
				}
			}))
				.addClass(`macro-${this.name}`)
				.append($image || document.createTextNode(text));

			if ($image) {
				$link.addClass('link-image');
			}
		}
	});


	/*******************************************************************************************************************
		DOM Macros.
	*******************************************************************************************************************/
	/*
		<<addclass>> & <<toggleclass>>
	*/
	Macro.add(['addclass', 'toggleclass'], {
		handler() {
			if (this.args.length < 2) {
				const errors = [];
				if (this.args.length < 1) { errors.push('selector'); }
				if (this.args.length < 2) { errors.push('class names'); }
				return this.error(`no ${errors.join(' or ')} specified`);
			}

			const $targets = jQuery(this.args[0]);

			if ($targets.length === 0) {
				return this.error(`no elements matched the selector "${this.args[0]}"`);
			}

			switch (this.name) {
			case 'addclass':
				$targets.addClass(this.args[1].trim());
				break;

			case 'toggleclass':
				$targets.toggleClass(this.args[1].trim());
				break;
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});

	/*
		<<removeclass>>
	*/
	Macro.add('removeclass', {
		handler() {
			if (this.args.length === 0) {
				return this.error('no selector specified');
			}

			const $targets = jQuery(this.args[0]);

			if ($targets.length === 0) {
				return this.error(`no elements matched the selector "${this.args[0]}"`);
			}

			if (this.args.length > 1) {
				$targets.removeClass(this.args[1].trim());
			}
			else {
				$targets.removeClass();
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});

	/*
		<<copy>>
	*/
	Macro.add('copy', {
		handler() {
			if (this.args.length === 0) {
				return this.error('no selector specified');
			}

			const $targets = jQuery(this.args[0]);

			if ($targets.length === 0) {
				return this.error(`no elements matched the selector "${this.args[0]}"`);
			}

			jQuery(this.output).append($targets.html());

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});

	/*
		<<append>>, <<prepend>>, & <<replace>>
	*/
	Macro.add(['append', 'prepend', 'replace'], {
		tags  : null,
		t8nRe : /^(?:transition|t8n)$/,

		handler() {
			if (this.args.length === 0) {
				return this.error('no selector specified');
			}

			const $targets = jQuery(this.args[0]);

			if ($targets.length === 0) {
				return this.error(`no elements matched the selector "${this.args[0]}"`);
			}

			if (this.payload[0].contents !== '') {
				const transition = this.args.length > 1 && this.self.t8nRe.test(this.args[1]);
				let $insert;

				if (transition) {
					$insert = jQuery(document.createElement('span'));
					$insert.addClass(`macro-${this.name}-insert macro-${this.name}-in`);
					setTimeout(() => $insert.removeClass(`macro-${this.name}-in`), Engine.minDomActionDelay);
				}
				else {
					$insert = jQuery(document.createDocumentFragment());
				}

				$insert.wiki(this.payload[0].contents);

				switch (this.name) {
				case 'replace':
					$targets.empty();
					/* falls through */

				case 'append':
					$targets.append($insert);
					break;

				case 'prepend':
					$targets.prepend($insert);
					break;
				}
			}
			else if (this.name === 'replace') {
				$targets.empty();
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}

			// re-number links
			Links.generate();
		}
	});

	/*
		<<remove>>
	*/
	Macro.add('remove', {
		handler() {
			if (this.args.length === 0) {
				return this.error('no selector specified');
			}

			const $targets = jQuery(this.args[0]);

			if ($targets.length === 0) {
				return this.error(`no elements matched the selector "${this.args[0]}"`);
			}

			$targets.remove();

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});


	/*******************************************************************************************************************
		Audio Macros.
	*******************************************************************************************************************/
	if (Has.audio) {
		const errorOnePlaybackAction = (cur, prev) => `only one playback action allowed per invocation, "${cur}" cannot be combined with "${prev}"`;

		/*
			<<audio>>
		*/
		Macro.add('audio', {
			handler() {
				if (this.args.length < 2) {
					const errors = [];
					if (this.args.length < 1) { errors.push('track and/or group IDs'); }
					if (this.args.length < 2) { errors.push('actions'); }
					return this.error(`no ${errors.join(' or ')} specified`);
				}

				let selected;

				// Process the track and/or group IDs.
				try {
					selected = SimpleAudio.select(this.args[0]);
				}
				catch (ex) {
					return this.error(ex.message);
				}

				const args = this.args.slice(1);
				let action;
				let fadeOver = 5;
				let fadeTo;
				let loop;
				let mute;
				let passage;
				let time;
				let volume;

				// Process arguments.
				while (args.length > 0) {
					const arg = args.shift();
					let raw;

					switch (arg) {
					case 'load':
					case 'pause':
					case 'play':
					case 'stop':
					case 'unload':
						if (action) {
							return this.error(errorOnePlaybackAction(arg, action));
						}

						action = arg;
						break;

					case 'fadein':
						if (action) {
							return this.error(errorOnePlaybackAction(arg, action));
						}

						action = 'fade';
						fadeTo = 1;
						break;

					case 'fadeout':
						if (action) {
							return this.error(errorOnePlaybackAction(arg, action));
						}

						action = 'fade';
						fadeTo = 0;
						break;

					case 'fadeto':
						if (action) {
							return this.error(errorOnePlaybackAction(arg, action));
						}

						if (args.length === 0) {
							return this.error('fadeto missing required level value');
						}

						action = 'fade';
						raw = args.shift();
						fadeTo = Number.parseFloat(raw);

						if (Number.isNaN(fadeTo) || !Number.isFinite(fadeTo)) {
							return this.error(`cannot parse fadeto: ${raw}`);
						}
						break;

					case 'fadeoverto':
						if (action) {
							return this.error(errorOnePlaybackAction(arg, action));
						}

						if (args.length < 2) {
							const errors = [];
							if (args.length < 1) { errors.push('seconds'); }
							if (args.length < 2) { errors.push('level'); }
							return this.error(`fadeoverto missing required ${errors.join(' and ')} value${errors.length > 1 ? 's' : ''}`);
						}

						action = 'fade';
						raw = args.shift();
						fadeOver = Number.parseFloat(raw);

						if (Number.isNaN(fadeOver) || !Number.isFinite(fadeOver)) {
							return this.error(`cannot parse fadeoverto: ${raw}`);
						}

						raw = args.shift();
						fadeTo = Number.parseFloat(raw);

						if (Number.isNaN(fadeTo) || !Number.isFinite(fadeTo)) {
							return this.error(`cannot parse fadeoverto: ${raw}`);
						}
						break;

					case 'volume':
						if (args.length === 0) {
							return this.error('volume missing required level value');
						}

						raw = args.shift();
						volume = Number.parseFloat(raw);

						if (Number.isNaN(volume) || !Number.isFinite(volume)) {
							return this.error(`cannot parse volume: ${raw}`);
						}
						break;

					case 'mute':
					case 'unmute':
						mute = arg === 'mute';
						break;

					case 'time':
						if (args.length === 0) {
							return this.error('time missing required seconds value');
						}

						raw = args.shift();
						time = Number.parseFloat(raw);

						if (Number.isNaN(time) || !Number.isFinite(time)) {
							return this.error(`cannot parse time: ${raw}`);
						}
						break;

					case 'loop':
					case 'unloop':
						loop = arg === 'loop';
						break;

					case 'goto':
						if (args.length === 0) {
							return this.error('goto missing required passage title');
						}

						raw = args.shift();

						if (typeof raw === 'object') {
							// Argument was in wiki link syntax.
							passage = raw.link;
						}
						else {
							// Argument was simply the passage name.
							passage = raw;
						}

						if (!Story.has(passage)) {
							return this.error(`passage "${passage}" does not exist`);
						}
						break;

					default:
						return this.error(`unknown action: ${arg}`);
					}
				}

				try {
					if (volume != null) { // lazy equality for null
						selected.volume(volume);
					}

					if (time != null) { // lazy equality for null
						selected.time(time);
					}

					if (mute != null) { // lazy equality for null
						selected.mute(mute);
					}

					if (loop != null) { // lazy equality for null
						selected.loop(loop);
					}

					if (passage != null) { // lazy equality for null
						const nsEnded = `ended.macros.macro-${this.name}_goto`;
						selected
							.off(nsEnded)
							.one(nsEnded, () => {
								selected.off(nsEnded);
								Engine.play(passage);
							});
					}

					switch (action) {
					case 'fade':
						selected.fade(fadeOver, fadeTo);
						break;

					case 'load':
						selected.load();
						break;

					case 'pause':
						selected.pause();
						break;

					case 'play':
						selected.playWhenAllowed();
						break;

					case 'stop':
						selected.stop();
						break;

					case 'unload':
						selected.unload();
						break;
					}

					// Custom debug view setup.
					if (Config.debug) {
						this.debugView.modes({ hidden : true });
					}
				}
				catch (ex) {
					return this.error(`error executing action: ${ex.message}`);
				}
			}
		});

		/*
			<<cacheaudio track_id source_list>>
		*/
		Macro.add('cacheaudio', {
			handler() {
				if (this.args.length < 2) {
					const errors = [];
					if (this.args.length < 1) { errors.push('track ID'); }
					if (this.args.length < 2) { errors.push('sources'); }
					return this.error(`no ${errors.join(' or ')} specified`);
				}

				const id       = String(this.args[0]).trim();
				const oldFmtRe = /^format:\s*([\w-]+)\s*;\s*/i;

				try {
					SimpleAudio.tracks.add(id, this.args.slice(1).map(source => {
						/* legacy */
						// Transform an old format specifier into the new style.
						if (oldFmtRe.test(source)) {
							// If in Test Mode, return an error.
							if (Config.debug) {
								return this.error(`track ID "${id}": format specifier migration required, "format:formatId;" \u2192 "formatId|"`);
							}

							source = source.replace(oldFmtRe, '$1|'); // eslint-disable-line no-param-reassign
						}

						return source;
						/* /legacy */
					}));
				}
				catch (ex) {
					return this.error(ex.message);
				}

				// If in Test Mode and no supported sources were specified, return an error.
				if (Config.debug && !SimpleAudio.tracks.get(id).hasSource()) {
					return this.error(`track ID "${id}": no supported audio sources found`);
				}

				// Custom debug view setup.
				if (Config.debug) {
					this.debugView.modes({ hidden : true });
				}
			}
		});

		/*
			<<createaudiogroup group_id>>
				<<track track_id>>
				…
			<</createaudiogroup>>
		*/
		Macro.add('createaudiogroup', {
			tags : ['track'],

			handler() {
				if (this.args.length === 0) {
					return this.error('no group ID specified');
				}

				if (this.payload.length === 1) {
					return this.error('no tracks defined via <<track>>');
				}

				// Initial debug view setup for `<<createaudiogroup>>`.
				if (Config.debug) {
					this.debugView
						.modes({
							nonvoid : false,
							hidden  : true
						});
				}

				const groupId  = String(this.args[0]).trim();
				const trackIds = [];

				for (let i = 1, len = this.payload.length; i < len; ++i) {
					if (this.payload[i].args.length < 1) {
						return this.error('no track ID specified');
					}

					trackIds.push(String(this.payload[i].args[0]).trim());

					// Custom debug view setup for the current `<<track>>`.
					if (Config.debug) {
						this
							.createDebugView(this.payload[i].name, this.payload[i].source)
							.modes({
								nonvoid : false,
								hidden  : true
							});
					}
				}

				try {
					SimpleAudio.groups.add(groupId, trackIds);
				}
				catch (ex) {
					return this.error(ex.message);
				}

				// Custom fake debug view setup for `<</createaudiogroup>>`.
				if (Config.debug) {
					this
						.createDebugView(`/${this.name}`, `<</${this.name}>>`)
						.modes({
							nonvoid : false,
							hidden  : true
						});
				}
			}
		});

		/*
			<<createplaylist list_id>>
				<<track track_id action_list>>
				…
			<</createplaylist>>
		*/
		Macro.add('createplaylist', {
			tags : ['track'],

			handler() {
				if (this.args.length === 0) {
					return this.error('no list ID specified');
				}

				if (this.payload.length === 1) {
					return this.error('no tracks defined via <<track>>');
				}

				const playlist = Macro.get('playlist');

				if (playlist.from !== null && playlist.from !== 'createplaylist') {
					return this.error('a playlist has already been defined with <<setplaylist>>');
				}

				// Initial debug view setup for `<<createplaylist>>`.
				if (Config.debug) {
					this.debugView
						.modes({
							nonvoid : false,
							hidden  : true
						});
				}

				const listId    = String(this.args[0]).trim();
				const trackObjs = [];

				for (let i = 1, len = this.payload.length; i < len; ++i) {
					if (this.payload[i].args.length === 0) {
						return this.error('no track ID specified');
					}

					const trackObj = { id : String(this.payload[i].args[0]).trim() };
					const args     = this.payload[i].args.slice(1);

					// Process arguments.
					while (args.length > 0) {
						const arg = args.shift();
						let raw;
						let parsed;

						switch (arg) {
						case 'copy': // [DEPRECATED]
						case 'own':
							trackObj.own = true;
							break;

						case 'rate':
							// if (args.length === 0) {
							// 	return this.error('rate missing required speed value');
							// }
							//
							// raw = args.shift();
							// parsed = Number.parseFloat(raw);
							//
							// if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
							// 	return this.error(`cannot parse rate: ${raw}`);
							// }
							//
							// trackObj.rate = parsed;
							if (args.length > 0) {
								args.shift();
							}
							break;

						case 'volume':
							if (args.length === 0) {
								return this.error('volume missing required level value');
							}

							raw = args.shift();
							parsed = Number.parseFloat(raw);

							if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
								return this.error(`cannot parse volume: ${raw}`);
							}

							trackObj.volume = parsed;
							break;

						default:
							return this.error(`unknown action: ${arg}`);
						}
					}

					trackObjs.push(trackObj);

					// Custom debug view setup for the current `<<track>>`.
					if (Config.debug) {
						this
							.createDebugView(this.payload[i].name, this.payload[i].source)
							.modes({
								nonvoid : false,
								hidden  : true
							});
					}
				}

				try {
					SimpleAudio.lists.add(listId, trackObjs);
				}
				catch (ex) {
					return this.error(ex.message);
				}

				// Lock `<<playlist>>` into our syntax.
				if (playlist.from === null) {
					playlist.from = 'createplaylist';
				}

				// Custom fake debug view setup for `<</createplaylist>>`.
				if (Config.debug) {
					this
						.createDebugView(`/${this.name}`, `<</${this.name}>>`)
						.modes({
							nonvoid : false,
							hidden  : true
						});
				}
			}
		});

		/*
			<<masteraudio action_list>>
		*/
		Macro.add('masteraudio', {
			handler() {
				if (this.args.length === 0) {
					return this.error('no actions specified');
				}

				const args = this.args.slice(0);
				let action;
				let mute;
				let muteOnHide;
				let volume;

				// Process arguments.
				while (args.length > 0) {
					const arg = args.shift();
					let raw;

					switch (arg) {
					case 'load':
					case 'stop':
					case 'unload':
						if (action) {
							return this.error(errorOnePlaybackAction(arg, action));
						}

						action = arg;
						break;

					case 'mute':
					case 'unmute':
						mute = arg === 'mute';
						break;

					case 'muteonhide':
					case 'nomuteonhide':
						muteOnHide = arg === 'muteonhide';
						break;

					case 'volume':
						if (args.length === 0) {
							return this.error('volume missing required level value');
						}

						raw = args.shift();
						volume = Number.parseFloat(raw);

						if (Number.isNaN(volume) || !Number.isFinite(volume)) {
							return this.error(`cannot parse volume: ${raw}`);
						}
						break;

					default:
						return this.error(`unknown action: ${arg}`);
					}
				}

				try {
					if (mute != null) { // lazy equality for null
						SimpleAudio.mute(mute);
					}

					if (muteOnHide != null) { // lazy equality for null
						SimpleAudio.muteOnHidden(muteOnHide);
					}

					if (volume != null) { // lazy equality for null
						SimpleAudio.volume(volume);
					}

					switch (action) {
					case 'load':
						SimpleAudio.load();
						break;

					case 'stop':
						SimpleAudio.stop();
						break;

					case 'unload':
						SimpleAudio.unload();
						break;
					}

					// Custom debug view setup.
					if (Config.debug) {
						this.debugView.modes({ hidden : true });
					}
				}
				catch (ex) {
					return this.error(`error executing action: ${ex.message}`);
				}
			}
		});

		/*
			<<playlist list_id action_list>>  ← <<createplaylist>> syntax
			<<playlist action_list>>          ← <<setplaylist>> syntax
		*/
		Macro.add('playlist', {
			from : null,

			handler() {
				const from = this.self.from;

				if (from === null) {
					return this.error('no playlists have been created');
				}

				let list;
				let args;

				if (from === 'createplaylist') {
					if (this.args.length < 2) {
						const errors = [];
						if (this.args.length < 1) { errors.push('list ID'); }
						if (this.args.length < 2) { errors.push('actions'); }
						return this.error(`no ${errors.join(' or ')} specified`);
					}

					const id = String(this.args[0]).trim();

					if (!SimpleAudio.lists.has(id)) {
						return this.error(`playlist "${id}" does not exist`);
					}

					list = SimpleAudio.lists.get(id);
					args = this.args.slice(1);
				}
				else {
					if (this.args.length === 0) {
						return this.error('no actions specified');
					}

					list = SimpleAudio.lists.get('setplaylist');
					args = this.args.slice(0);
				}

				let action;
				let fadeOver = 5;
				let fadeTo;
				let loop;
				let mute;
				let shuffle;
				let volume;

				// Process arguments.
				while (args.length > 0) {
					const arg = args.shift();
					let raw;

					switch (arg) {
					case 'load':
					case 'pause':
					case 'play':
					case 'skip':
					case 'stop':
					case 'unload':
						if (action) {
							return this.error(errorOnePlaybackAction(arg, action));
						}

						action = arg;
						break;

					case 'fadein':
						if (action) {
							return this.error(errorOnePlaybackAction(arg, action));
						}

						action = 'fade';
						fadeTo = 1;
						break;

					case 'fadeout':
						if (action) {
							return this.error(errorOnePlaybackAction(arg, action));
						}

						action = 'fade';
						fadeTo = 0;
						break;

					case 'fadeto':
						if (action) {
							return this.error(errorOnePlaybackAction(arg, action));
						}

						if (args.length === 0) {
							return this.error('fadeto missing required level value');
						}

						action = 'fade';
						raw = args.shift();
						fadeTo = Number.parseFloat(raw);

						if (Number.isNaN(fadeTo) || !Number.isFinite(fadeTo)) {
							return this.error(`cannot parse fadeto: ${raw}`);
						}
						break;

					case 'fadeoverto':
						if (action) {
							return this.error(errorOnePlaybackAction(arg, action));
						}

						if (args.length < 2) {
							const errors = [];
							if (args.length < 1) { errors.push('seconds'); }
							if (args.length < 2) { errors.push('level'); }
							return this.error(`fadeoverto missing required ${errors.join(' and ')} value${errors.length > 1 ? 's' : ''}`);
						}

						action = 'fade';
						raw = args.shift();
						fadeOver = Number.parseFloat(raw);

						if (Number.isNaN(fadeOver) || !Number.isFinite(fadeOver)) {
							return this.error(`cannot parse fadeoverto: ${raw}`);
						}

						raw = args.shift();
						fadeTo = Number.parseFloat(raw);

						if (Number.isNaN(fadeTo) || !Number.isFinite(fadeTo)) {
							return this.error(`cannot parse fadeoverto: ${raw}`);
						}
						break;

					case 'volume':
						if (args.length === 0) {
							return this.error('volume missing required level value');
						}

						raw = args.shift();
						volume = Number.parseFloat(raw);

						if (Number.isNaN(volume) || !Number.isFinite(volume)) {
							return this.error(`cannot parse volume: ${raw}`);
						}
						break;

					case 'mute':
					case 'unmute':
						mute = arg === 'mute';
						break;

					case 'loop':
					case 'unloop':
						loop = arg === 'loop';
						break;

					case 'shuffle':
					case 'unshuffle':
						shuffle = arg === 'shuffle';
						break;

					default:
						return this.error(`unknown action: ${arg}`);
					}
				}

				try {
					if (volume != null) { // lazy equality for null
						list.volume(volume);
					}

					if (mute != null) { // lazy equality for null
						list.mute(mute);
					}

					if (loop != null) { // lazy equality for null
						list.loop(loop);
					}

					if (shuffle != null) { // lazy equality for null
						list.shuffle(shuffle);
					}

					switch (action) {
					case 'fade':
						list.fade(fadeOver, fadeTo);
						break;

					case 'load':
						list.load();
						break;

					case 'pause':
						list.pause();
						break;

					case 'play':
						list.playWhenAllowed();
						break;

					case 'skip':
						list.skip();
						break;

					case 'stop':
						list.stop();
						break;

					case 'unload':
						list.unload();
						break;
					}

					// Custom debug view setup.
					if (Config.debug) {
						this.debugView.modes({ hidden : true });
					}
				}
				catch (ex) {
					return this.error(`error executing action: ${ex.message}`);
				}
			}
		});

		/*
			<<removeaudiogroup group_id>>
		*/
		Macro.add('removeaudiogroup', {
			handler() {
				if (this.args.length === 0) {
					return this.error('no group ID specified');
				}

				const id = String(this.args[0]).trim();

				if (!SimpleAudio.groups.has(id)) {
					return this.error(`group "${id}" does not exist`);
				}

				SimpleAudio.groups.delete(id);

				// Custom debug view setup.
				if (Config.debug) {
					this.debugView.modes({ hidden : true });
				}
			}
		});

		/*
			<<removeplaylist list_id>>
		*/
		Macro.add('removeplaylist', {
			handler() {
				if (this.args.length === 0) {
					return this.error('no list ID specified');
				}

				const id = String(this.args[0]).trim();

				if (!SimpleAudio.lists.has(id)) {
					return this.error(`playlist "${id}" does not exist`);
				}

				SimpleAudio.lists.delete(id);

				// Custom debug view setup.
				if (Config.debug) {
					this.debugView.modes({ hidden : true });
				}
			}
		});

		/*
			<<waitforaudio>>
		*/
		Macro.add('waitforaudio', {
			skipArgs : true,

			handler() {
				SimpleAudio.loadWithScreen();
			}
		});

		/*
			[DEPRECATED] <<setplaylist track_id_list>>
		*/
		Macro.add('setplaylist', {
			handler() {
				if (this.args.length === 0) {
					return this.error('no track ID(s) specified');
				}

				const playlist = Macro.get('playlist');

				if (playlist.from !== null && playlist.from !== 'setplaylist') {
					return this.error('playlists have already been defined with <<createplaylist>>');
				}

				// Create the new playlist.
				try {
					SimpleAudio.lists.add('setplaylist', this.args.slice(0));
				}
				catch (ex) {
					return this.error(ex.message);
				}

				// Lock `<<playlist>>` into our syntax.
				if (playlist.from === null) {
					playlist.from = 'setplaylist';
				}

				// Custom debug view setup.
				if (Config.debug) {
					this.debugView.modes({ hidden : true });
				}
			}
		});

		/*
			[DEPRECATED] <<stopallaudio>>
		*/
		Macro.add('stopallaudio', {
			skipArgs : true,

			handler() {
				SimpleAudio.select(':all').stop();

				// Custom debug view setup.
				if (Config.debug) {
					this.debugView.modes({ hidden : true });
				}
			}
		});
	}
	else {
		/* The HTML5 <audio> API appears to be missing or disabled, set up no-op macros. */
		Macro.add([
			'audio',
			'cacheaudio',
			'createaudiogroup',
			'createplaylist',
			'masteraudio',
			'playlist',
			'removeaudiogroup',
			'removeplaylist',
			'waitforaudio',

			// Deprecated.
			'setplaylist',
			'stopallaudio'
		], {
			skipArgs : true,

			handler() {
				/* no-op */

				// Custom debug view setup.
				if (Config.debug) {
					this.debugView.modes({ hidden : true });
				}
			}
		});
	}


	/*******************************************************************************************************************
		Miscellaneous Macros.
	*******************************************************************************************************************/
	/*
		<<done>>
	*/
	Macro.add('done', {
		skipArgs : true,
		tags     : null,

		handler() {
			const contents = this.payload[0].contents.trim();

			// Do nothing if there's no content to process.
			if (contents === '') {
				return;
			}

			setTimeout(this.createShadowWrapper(
				() => $.wiki(contents)
			), Engine.minDomActionDelay);
		}
	});

	/*
		<<goto>>
	*/
	Macro.add('goto', {
		handler() {
			if (this.args.length === 0) {
				return this.error('no passage specified');
			}

			let passage;

			if (typeof this.args[0] === 'object') {
				// Argument was in wiki link syntax.
				passage = this.args[0].link;
			}
			else {
				// Argument was simply the passage name.
				passage = this.args[0];
			}

			if (!Story.has(passage)) {
				return this.error(`passage "${passage}" does not exist`);
			}

			/*
				Call `Engine.play()` asynchronously.

				NOTE: This does not terminate the current Wikifier call chain,
				though, ideally, it should.  Doing so would not be trivial, however,
				and there's also the question of whether that behavior would be
				unwanted by users, who are used to the current behavior from
				similar macros and constructs.
			*/
			if (!Config.navigation.gotohell) Wikifier.stopWikify = 2; // actually, let's make it.
			setTimeout(() => Engine.play(passage), Engine.minDomActionDelay);
		}
	});

	/*
		<<repeat>> & <<stop>>
	*/
	Macro.add('repeat', {
		isAsync : true,
		tags    : null,
		timers  : new Set(),
		t8nRe   : /^(?:transition|t8n)$/,

		handler() {
			if (this.args.length === 0) {
				return this.error('no time value specified');
			}

			let delay;

			try {
				delay = Math.max(Engine.minDomActionDelay, Util.fromCssTime(this.args[0]));
			}
			catch (ex) {
				return this.error(ex.message);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			const transition = this.args.length > 1 && this.self.t8nRe.test(this.args[1]);
			const $wrapper   = jQuery(document.createElement('span'))
				.addClass(`macro-${this.name}`)
				.appendTo(this.output);

			// Register the timer.
			this.self.registerInterval(this.createShadowWrapper(() => {
				const frag = document.createDocumentFragment();
				new Wikifier(frag, this.payload[0].contents);

				let $output = $wrapper;

				if (transition) {
					$output = jQuery(document.createElement('span'))
						.addClass('macro-repeat-insert macro-repeat-in')
						.appendTo($output);
				}

				$output.append(frag);

				if (transition) {
					setTimeout(() => $output.removeClass('macro-repeat-in'), Engine.minDomActionDelay);
				}
			}), delay);
		},

		registerInterval(callback, delay) {
			if (typeof callback !== 'function') {
				throw new TypeError('callback parameter must be a function');
			}

			// Cache info about the current turn.
			const passage = State.passage;
			const turn    = State.turns;

			// Timer info.
			const timers = this.timers;
			let timerId = null;

			// Set up the interval.
			timerId = setInterval(() => {
				// Terminate if we've navigated away.
				if (State.passage !== passage || State.turns !== turn) {
					clearInterval(timerId);
					timers.delete(timerId);
					return;
				}

				let timerIdCache;
				/*
					There's no catch clause because this try/finally is here simply to ensure that
					proper cleanup is done in the event that an exception is thrown during the
					`Wikifier` call.
				*/
				try {
					TempState.break = null;

					// Set up the `repeatTimerId` value, caching the existing value, if necessary.
					if (TempState.hasOwnProperty('repeatTimerId')) {
						timerIdCache = TempState.repeatTimerId;
					}

					TempState.repeatTimerId = timerId;

					// Execute the callback.
					callback.call(this);
				}
				finally {
					// Teardown the `repeatTimerId` property, restoring the cached value, if necessary.
					if (typeof timerIdCache !== 'undefined') {
						TempState.repeatTimerId = timerIdCache;
					}
					else {
						delete TempState.repeatTimerId;
					}

					TempState.break = null;
				}
			}, delay);
			timers.add(timerId);

			// Set up a single-use `prehistory` task to remove pending timers.
			if (!prehistory.hasOwnProperty('#repeat-timers-cleanup')) {
				prehistory['#repeat-timers-cleanup'] = task => {
					delete prehistory[task]; // single-use task
					timers.forEach(timerId => clearInterval(timerId));
					timers.clear();
				};
			}
		}
	});
	Macro.add('stop', {
		skipArgs : true,

		handler() {
			if (!TempState.hasOwnProperty('repeatTimerId')) {
				return this.error('must only be used in conjunction with its parent macro <<repeat>>');
			}

			const timers  = Macro.get('repeat').timers;
			const timerId = TempState.repeatTimerId;
			clearInterval(timerId);
			timers.delete(timerId);
			TempState.break = 2;

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});

	/*
		<<timed>> & <<next>>
	*/
	Macro.add('timed', {
		isAsync : true,
		tags    : ['next'],
		timers  : new Set(),
		t8nRe   : /^(?:transition|t8n)$/,

		handler() {
			if (this.args.length === 0) {
				return this.error('no time value specified in <<timed>>');
			}

			const items = [];

			try {
				items.push({
					name    : this.name,
					source  : this.source,
					delay   : Math.max(Engine.minDomActionDelay, Util.fromCssTime(this.args[0])),
					content : this.payload[0].contents
				});
			}
			catch (ex) {
				return this.error(`${ex.message} in <<timed>>`);
			}

			if (this.payload.length > 1) {
				let i;

				try {
					let len;

					for (i = 1, len = this.payload.length; i < len; ++i) {
						items.push({
							name   : this.payload[i].name,
							source : this.payload[i].source,
							delay  : this.payload[i].args.length === 0
								? items[items.length - 1].delay
								: Math.max(Engine.minDomActionDelay, Util.fromCssTime(this.payload[i].args[0])),
							content : this.payload[i].contents
						});
					}
				}
				catch (ex) {
					return this.error(`${ex.message} in <<next>> (#${i})`);
				}
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			const transition = this.args.length > 1 && this.self.t8nRe.test(this.args[1]);
			const $wrapper   = jQuery(document.createElement('span'))
				.addClass(`macro-${this.name}`)
				.appendTo(this.output);

			// Register the timer.
			this.self.registerTimeout(this.createShadowWrapper(item => {
				const frag = document.createDocumentFragment();
				new Wikifier(frag, item.content);

				// Output.
				let $output = $wrapper;

				// Custom debug view setup for `<<next>>`.
				if (Config.debug && item.name === 'next') {
					$output = jQuery(new DebugView( // eslint-disable-line no-param-reassign
						$output[0],
						'macro',
						item.name,
						item.source
					).output);
				}

				if (transition) {
					$output = jQuery(document.createElement('span'))
						.addClass('macro-timed-insert macro-timed-in')
						.appendTo($output);
				}

				$output.append(frag);

				if (transition) {
					setTimeout(() => $output.removeClass('macro-timed-in'), Engine.minDomActionDelay);
				}
			}), items);
		},

		registerTimeout(callback, items) {
			if (typeof callback !== 'function') {
				throw new TypeError('callback parameter must be a function');
			}

			// Cache info about the current turn.
			const passage = State.passage;
			const turn    = State.turns;

			// Timer info.
			const timers = this.timers;
			let timerId  = null;
			let nextItem = items.shift();

			const worker = function () {
				// Bookkeeping.
				timers.delete(timerId);

				// Terminate if we've navigated away.
				if (State.passage !== passage || State.turns !== turn) {
					return;
				}

				// Set the current item and set up the next worker, if any.
				const curItem = nextItem;

				if ((nextItem = items.shift()) != null) { // lazy equality for null
					timerId = setTimeout(worker, nextItem.delay);
					timers.add(timerId);
				}

				// Execute the callback.
				callback.call(this, curItem);
			};

			// Setup the timeout.
			timerId = setTimeout(worker, nextItem.delay);
			timers.add(timerId);

			// Set up a single-use `prehistory` task to remove pending timers.
			if (!prehistory.hasOwnProperty('#timed-timers-cleanup')) {
				prehistory['#timed-timers-cleanup'] = task => {
					delete prehistory[task]; // single-use task
					timers.forEach(timerId => clearTimeout(timerId)); // eslint-disable-line no-shadow
					timers.clear();
				};
			}
		}
	});

	/*
		<<widget>>
	*/
	Macro.add('widget', {
		tags : null,

		handler() {
			if (this.args.length === 0) {
				return this.error('no widget name specified');
			}

			const widgetName = this.args[0];
			const isNonVoid  = this.args.length > 1 && this.args[1] === 'container';

			if (Macro.has(widgetName)) {
				if (!Macro.get(widgetName).isWidget) {
					return this.error(`cannot clobber existing macro "${widgetName}"`);
				}

				// Delete the existing widget.
				Macro.delete(widgetName);
			}

			try {
				const widgetDef = {
					isWidget : true,
					handler  : (function (widgetCode) {
						return function () {
							const shadowStore = {};

							// Cache the existing value of the `_args` variable, if necessary.
							if (State.temporary.hasOwnProperty('args')) {
								shadowStore._args = State.temporary.args;
							}

							// Set up the widget `_args` variable and add a shadow.
							State.temporary.args = [...this.args];
							State.temporary.args.raw = this.args.raw;
							State.temporary.args.full = this.args.full;
							this.addShadow('_args');

							if (isNonVoid) {
								// Cache the existing value of the `_contents` variable, if necessary.
								if (State.temporary.hasOwnProperty('contents')) {
									shadowStore._contents = State.temporary.contents;
								}

								// Set up the widget `_contents` variable and add a shadow.
								State.temporary.contents = this.payload[0].contents;
								this.addShadow('_contents');
							}

							/* legacy */
							// Cache the existing value of the `$args` variable, if necessary.
							if (State.variables.hasOwnProperty('args')) {
								shadowStore.$args = State.variables.args;
							}

							// Set up the widget `$args` variable and add a shadow.
							State.variables.args = State.temporary.args;
							this.addShadow('$args');
							/* /legacy */

							try {
								// Set up the error trapping variables.
								const resFrag = document.createDocumentFragment();
								const errList = [];

								// Wikify the widget's code.
								new Wikifier(resFrag, widgetCode);

								// Carry over the output, unless there were errors.
								Array.from(resFrag.querySelectorAll('.error')).forEach(errEl => {
									errList.push(errEl.textContent);
								});

								if (errList.length === 0) {
									this.output.appendChild(resFrag);
								}
								else {
									return this.error(`error${errList.length > 1 ? 's' : ''} within widget code (${errList.join('; ')})`);
								}
							}
							catch (ex) {
								return this.error(`cannot execute widget: ${ex.message}`);
							}
							finally {
								// Revert the `_args` variable shadowing.
								if (shadowStore.hasOwnProperty('_args')) {
									State.temporary.args = shadowStore._args;
								}
								else {
									delete State.temporary.args;
								}

								if (isNonVoid) {
									// Revert the `_contents` variable shadowing.
									if (shadowStore.hasOwnProperty('_contents')) {
										State.temporary.contents = shadowStore._contents;
									}
									else {
										delete State.temporary.contents;
									}
								}

								/* legacy */
								// Revert the `$args` variable shadowing.
								if (shadowStore.hasOwnProperty('$args')) {
									State.variables.args = shadowStore.$args;
								}
								else {
									delete State.variables.args;
								}
								/* /legacy */
							}
						};
					})(this.payload[0].contents)
				};

				if (isNonVoid) {
					widgetDef.tags = [];
				}

				Macro.add(widgetName, widgetDef);

				// Custom debug view setup.
				if (Config.debug) {
					this.debugView.modes({ hidden : true });
				}
			}
			catch (ex) {
				return this.error(`cannot create widget macro "${widgetName}": ${ex.message}`);
			}
		}
	});

	/*
		<<exit>> & <<exitAll>>
	*/
	Macro.add(['exit', 'exitAll'], {
		handler() {
			Wikifier.stopWikify = this.name === 'exit' ? 1 : 2;
		}
	});
})();

/***********************************************************************************************************************

	util/gettypeof.js

	Copyright © 2013–2023 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/

/*
	Returns the value `'null'` for `null`, the value yielded by `typeof` for
	primitives and functions, or the `@@toStringTag` internal property for objects.

	Examples:
		getTypeOf(42n)            → 'bigint'
		getTypeOf(true)           → 'boolean'
		getTypeOf(function () {}) → 'function'
		getTypeOf(42)             → 'number'
		getTypeOf(null)           → 'null'
		getTypeOf("fnord")        → 'string'
		getTypeOf(Symbol("ZETA")) → 'symbol'
		getTypeOf(undefined)      → 'undefined'
		getTypeOf(['a', 'b'])     → 'Array'
		getTypeOf({ a : 'b' })    → 'Object'
		getTypeOf(new Date())     → 'Date'
		getTypeOf(new Map())      → 'Map'
		getTypeOf(new Set())      → 'Set'
		Etc.
*/
var getTypeOf = (() => { // eslint-disable-line no-unused-vars, no-var
	// Cache built-in object method.
	const toString = Object.prototype.toString;
	const slice    = String.prototype.slice;

	function getTypeOf(O) {
		// Special case for `null`, since `typeof` is a buggy piece of shit.
		if (O === null) { return 'null'; }

		const baseType = typeof O;
		return baseType === 'object' ? slice.call(toString.call(O), 8, -1) : baseType;
	}

	return getTypeOf;
})();

/***********************************************************************************************************************

	dialog.js

	Copyright © 2013–2023 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Has, L10n, Story, getTypeOf */

var Dialog = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Default top position.
	const DEFAULT_TOP = 50; // in pixels w/o unit

	// jQuery-wrapped dialog elements.
	let $overlay = null;
	let $dialog  = null;
	let $title   = null;
	let $body    = null;

	// Last active/focused non-dialog element.
	let lastActive = null;

	// Mutation resize handler.
	let observer = null;

	// Active close callback, if any.
	let onCloseFn = null;

	// Width of the browser's scrollbars.
	let scrollbarWidth = 0;


	/*******************************************************************************
		Initialization Functions.
	*******************************************************************************/

	function init() {
		if (DEBUG) { console.log('[Dialog/init()]'); }

		if (document.getElementById('ui-dialog')) {
			return;
		}

		// Calculate and record the width of scrollbars.
		scrollbarWidth = (() => {
			let calcWidth;

			try {
				const inner = document.createElement('p');
				inner.style.width  = '100%';
				inner.style.height = '200px';

				const outer = document.createElement('div');
				outer.style.position   = 'absolute';
				outer.style.left       = '0';
				outer.style.top        = '0';
				outer.style.width      = '100px';
				outer.style.height     = '100px';
				outer.style.visibility = 'hidden';
				outer.style.overflow   = 'hidden';

				outer.appendChild(inner);
				document.body.appendChild(outer);

				const w1 = inner.offsetWidth;
				// The `overflow: scroll` style property value does not work consistently
				// with scrollbars which are styled with `::-webkit-scrollbar`, so we use
				// `overflow: auto` with dimensions guaranteed to force a scrollbar.
				outer.style.overflow = 'auto';
				let w2 = inner.offsetWidth;

				if (w1 === w2) {
					w2 = outer.clientWidth;
				}

				document.body.removeChild(outer);

				calcWidth = w1 - w2;
			}
			catch (ex) { /* no-op */ }

			return calcWidth || 17; // 17px is a reasonable failover
		})();

		// Generate the dialog elements.
		const $elems = jQuery(document.createDocumentFragment())
			.append(
				/* eslint-disable max-len */
				  '<div id="ui-overlay" class="ui-close"></div>'
				+ '<div id="ui-dialog" tabindex="0" role="dialog" aria-labelledby="ui-dialog-title" aria-modal="true">'
				+     '<div id="ui-dialog-titlebar">'
				+         '<h1 id="ui-dialog-title"></h1>'
				+         `<button id="ui-dialog-close" class="ui-close" tabindex="0" aria-label="${L10n.get('textClose')}">\ue804</button>`
				+     '</div>'
				+     '<div id="ui-dialog-body"></div>'
				+ '</div>'
				/* eslint-enable max-len */
			);

		// Cache the dialog elements, since they're going to be used often.
		//
		// NOTE: We rewrap the elements themselves, rather than simply using
		// the results of `find()`, so that we cache uncluttered jQuery-wrappers
		// (i.e. `context` refers to the elements and there is no `prevObject`).
		$overlay = jQuery($elems.find('#ui-overlay').get(0));
		$dialog  = jQuery($elems.find('#ui-dialog').get(0));
		$title   = jQuery($elems.find('#ui-dialog-title').get(0));
		$body    = jQuery($elems.find('#ui-dialog-body').get(0));

		// Insert the dialog elements into the page before the main script.
		$elems.insertBefore('body>script#script-sugarcube');
	}


	/*******************************************************************************
		Utility Functions.
	*******************************************************************************/

	/*
		Calculate the inset values, in pixels, required to fit the dialog within
		the current viewport based on the size of its contents and the viewport's
		dimentions.
	*/
	function calcInset(top) {
		const $window = jQuery(window);
		const inset   = { left : '', right : '', top : '', bottom : '' };
		const minPos  = 10;

		// Unset the dialog's inset values, so the browser can resize it based on
		// its content.
		$dialog.css(inset);

		// Calculate the dialog's new inset values based on its current dimensions.
		//
		// NOTE: Subtract `1` from both space values to address a Firefox issue.
		// QUESTION: Is this still necessary?
		let horzSpace = $window.width() - $dialog.outerWidth(true) - 1;
		let vertSpace = $window.height() - $dialog.outerHeight(true) - 1;

		if (horzSpace <= minPos * 2 + scrollbarWidth) {
			vertSpace -= scrollbarWidth;
		}

		if (vertSpace <= minPos * 2 + scrollbarWidth) {
			horzSpace -= scrollbarWidth;
		}

		/* eslint-disable prefer-template */
		// Calculate the horizontal inset values in pixels.
		if (horzSpace <= minPos * 2) {
			inset.left = inset.right = minPos + 'px';
		}
		else {
			inset.left = inset.right = (horzSpace / 2 >> 0) + 'px';
		}

		// Calculate the vertical inset values in pixels.
		if (vertSpace <= minPos * 2) {
			inset.top = inset.bottom = minPos + 'px';
		}
		else {
			const vertPos = vertSpace / 2 >> 0;

			if (vertPos > top) {
				inset.top = top + 'px';
			}
			else {
				inset.top = inset.bottom = vertPos + 'px';
			}
		}
		/* eslint-enable prefer-template */

		return inset;
	}

	/*
		Resize handler.
	*/
	function onResize(top) {
		if ($dialog.css('display') === 'block') {
			$dialog.css(calcInset(top != null ? top : DEFAULT_TOP)); // lazy equality for null
		}
	}


	/*******************************************************************************
		API Functions.
	*******************************************************************************/

	/*
		Appends the specified content sources to the dialog's body container.
		Returns `Dialog` for further chaining.
	*/
	function append(...args) {
		$body.append(...args);
		return Dialog;
	}

	/*
		Closes and resets the dialog.
		Returns `Dialog` for further chaining.
	*/
	function close(ev) {
		// Trigger a `:dialogclosing` event on the dialog body.
		$body.trigger(':dialogclosing');

		// Largely reverse the actions taken in `dialogOpen()`.
		jQuery(document).off('.dialog-close');

		if (observer) {
			observer.disconnect();
			observer = null;
		}
		else {
			$body.off('.dialog-resize');
		}

		jQuery(window)
			.off('.dialog-resize');
		$dialog
			.removeClass('open')
			.css({ left : '', right : '', top : '', bottom : '' });

		jQuery('#ui-bar,#story')
			.find('[tabindex=-2]')
			.removeAttr('aria-hidden')
			.attr('tabindex', 0);
		jQuery('body>[tabindex=-3]')
			.removeAttr('aria-hidden')
			.removeAttr('tabindex');

		$overlay
			.removeClass('open');
		jQuery(document.documentElement)
			.removeAttr('data-dialog');

		// Clear the dialog's content.
		$title
			.empty();
		$body
			.empty()
			.removeClass();

		// Attempt to restore focus to whichever element had it prior to opening the dialog.
		if (lastActive) {
			lastActive.focus();
			lastActive = null;
		}

		// Call the given close callback, if any.
		if (onCloseFn) {
			// NOTE: There's no catch clause here because this try/finally exists
			// solely to ensure that the close callback is properly reset in the
			// event that an uncaught exception is thrown during the callback call.
			try {
				onCloseFn(ev);
			}
			finally {
				onCloseFn = null;
			}
		}

		// Trigger a `:dialogclosed` event on the dialog body.
		/* legacy */
		$body.trigger(':dialogclose');
		/* /legacy */
		$body.trigger(':dialogclosed');

		return Dialog;
	}

	/*
		Prepares the dialog for use.
		Returns `Dialog` for further chaining.
	*/
	function create(title, classNames) {
		$title
			.empty()
			.append((title != null ? String(title) : '') || '\u00A0'); // lazy equality for null

		$body
			.empty()
			.removeClass();

		if (classNames != null) { // lazy equality for null
			$body.addClass(classNames);
		}

		return Dialog;
	}

	/*
		Empties the dialog's body container.
		Returns `Dialog` for further chaining.
	*/
	function empty() {
		$body.empty();
		return Dialog;
	}

	/*
		Returns the dialog's body container.
	*/
	function getBody() {
		return $body.get(0);
	}

	/*
		Returns whether the dialog is open.
		The test may be narrowed by specifing class names.
	*/
	function isOpen(classNames) {
		return $dialog.hasClass('open')
			&& (classNames ? classNames.splitOrEmpty(/\s+/).every(cn => $body.hasClass(cn)) : true);
	}

	/*
		Opens the dialog.
		Returns `Dialog` for further chaining.
	*/
	function open(options, onClose) {
		// Grab the options we care about.
		const { top } = Object.assign({ top : DEFAULT_TOP }, options);

		// Record the given close callback.
		if (onClose != null) { // lazy equality for null
			const closeType = getTypeOf(onClose);

			if (closeType !== 'function') {
				throw new TypeError(`Dialog.open onClose parameter must be a function (received: ${closeType})`);
			}

			onCloseFn = onClose;
		}
		else {
			onCloseFn = null;
		}

		// Trigger a `:dialogopening` event on the dialog body.
		$body.trigger(':dialogopening');

		// Record the last active/focused non-dialog element.
		if (!isOpen()) {
			lastActive = document.activeElement || null;
		}

		// Add the `data-dialog` attribute to <html> (mostly used to style <body>).
		jQuery(document.documentElement).attr('data-dialog', 'open');

		// Display the overlay.
		$overlay.addClass('open');

		// Add `aria-hidden=true` to all direct non-dialog-children of <body> to
		// hide the underlying page from screen readers while the dialog is open.
		jQuery('body>:not(script,#store-area,tw-storydata,#ui-bar,#ui-overlay,#ui-dialog)')
			.attr('tabindex', -3)
			.attr('aria-hidden', true);
		jQuery('#ui-bar,#story')
			.find('[tabindex]:not([tabindex^=-])')
			.attr('tabindex', -2)
			.attr('aria-hidden', true);

		// Create our throttled resize handler.
		const resizeHandler = jQuery.throttle(40, () => onResize(top));

		// Add the imagesLoaded handlers to images.
		$body.imagesLoaded().always(resizeHandler);

		// Display the dialog.
		$dialog
			.css(calcInset(top))
			.addClass('open')
			.focus();

		// Attach the window `resize` event resize handler.
		jQuery(window)
			.off('.dialog-resize')
			.on('resize.dialog-resize', resizeHandler);

		// Add the dialog mutation resize handler.
		if (Has.mutationObserver) {
			observer = new MutationObserver(mutations => {
				for (let i = 0; i < mutations.length; ++i) {
					if (mutations[i].type === 'childList') {
						$body.imagesLoaded().always(resizeHandler);
						resizeHandler();
						break;
					}
				}
			});
			observer.observe(getBody(), {
				childList : true,
				subtree   : true
			});
		}
		else {
			$body
				.off('.dialog-resize')
				.on(
					'DOMNodeInserted.dialog-resize DOMNodeRemoved.dialog-resize',
					() => {
						$body.imagesLoaded().always(resizeHandler);
						resizeHandler();
					}
				);
		}

		// Set up the delegated close handler.
		jQuery(document)
			.off('.dialog-close')
			.one('click.dialog-close', '.ui-close', ev => {
				// NOTE: Do not allow this event handler to return the `Dialog` static object,
				// as doing so causes Edge (ca. 18) to throw a "Number expected" exception due
				// to `Dialog` not having a prototype.
				close(ev);
				/* implicit `return undefined;` */
			})
			.one('keypress.dialog-close', '.ui-close', function (ev) {
				// 13 is Enter/Return, 32 is Space.
				if (ev.which === 13 || ev.which === 32) {
					jQuery(this).trigger('click');
				}
			});

		// Trigger a `:dialogopened` event on the dialog body.
		/* legacy */
		$body.trigger(':dialogopen');
		/* /legacy */
		$body.trigger(':dialogopened');

		return Dialog;
	}

	/*
		Resize the dialog.
	*/
	function resize(options) {
		return onResize(typeof options === 'object' ? options.top : undefined);
	}

	/*
		Renders and appends the specified content sources to the dialog's body container.
		Returns `Dialog` for further chaining.
	*/
	function wiki(...args) {
		$body.wiki(...args);
		return Dialog;
	}

	/*
		Renders and appends the specified passage to the dialog's body container.
		Returns `Dialog` for further chaining.
	*/
	function wikiPassage(name) {
		return wiki(Story.get(name).processText());
	}


	/*******************************************************************************
		Deprecated Functions.
	*******************************************************************************/

	/*
		[DEPRECATED] Prepares the dialog for use.
		Returns the dialog's body container.
	*/
	function setup(title, classNames) {
		// console.warn('[DEPRECATED] Dialog.setup() is deprecated.');

		create(title, classNames);
		return getBody();
	}


	/*******************************************************************************
		Object Exports.
	*******************************************************************************/

	return Object.preventExtensions(Object.create(null, {
		append      : { value : append },
		body        : { value : getBody },
		close       : { value : close },
		create      : { value : create },
		empty       : { value : empty },
		init        : { value : init },
		isOpen      : { value : isOpen },
		open        : { value : open },
		resize      : { value : resize },
		wiki        : { value : wiki },
		wikiPassage : { value : wikiPassage },

		// Deprecated Functions.
		setup : { value : setup }
	}));
})();

/***********************************************************************************************************************

	engine.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/*
	global Alert, Config, DebugView, Dialog, Has, LoadScreen, Save, State, Story, StyleWrapper, UI, UIBar, Util,
	       Wikifier, postdisplay, postrender, predisplay, prehistory, prerender, setDisplayTitle
*/

var Engine = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Engine state types object (pseudo-enumeration).
	const States = Util.toEnum({
		Idle      : 'idle',
		Playing   : 'playing',
		Rendering : 'rendering'
	});

	// Minimum delay for DOM actions (in milliseconds).
	const minDomActionDelay = 40;

	// Cache of the debug view(s) for initialization special passage(s).
	const _initDebugViews = [];

	// Current state of the engine (default: `Engine.States.Idle`).
	let _state = States.Idle;

	// Last time `enginePlay()` was called (in milliseconds).
	let _lastPlay = null;

	// Cache of the outline patching <style> element (`StyleWrapper`-wrapped).
	let _outlinePatch = null;

	// List of objects describing `StoryInterface` elements to update via passages during navigation.
	let _updating = null;


	/*******************************************************************************************************************
		Engine Functions.
	*******************************************************************************************************************/
	/*
		Initialize the core story elements and perform some bookkeeping.
	*/
	function engineInit() {
		if (DEBUG) { console.log('[Engine/engineInit()]'); }

		/*
			Remove #init-no-js & #init-lacking from #init-screen.
		*/
		jQuery('#init-no-js,#init-lacking').remove();

		/*
			Generate the core story elements and insert them into the page before the store area.
		*/
		(() => {
			const $elems = jQuery(document.createDocumentFragment());
			const markup = Story.has('StoryInterface') && Story.get('StoryInterface').text.trim();

			if (markup) {
				// Remove the UI bar, its styles, and events.
				UIBar.destroy();

				// Remove the core display area styles.
				jQuery(document.head).find('#style-core-display').remove();

				$elems.append(markup);

				const $passages = $elems.find('#passages');

				if ($passages.length === 0) {
					throw new Error('no element with ID "passages" found within "StoryInterface" special passage');
				}

				// Empty `#passages` and set the `aria-live` content attribute to `'polite'` if necessary.
				$passages
					.empty()

					// Without an existing `aria-live`.
					.not('[aria-live]')
					.attr('aria-live', 'polite')
					.end();

				// Data passage elements updated once during initialization.
				$elems.find('[data-init-passage]').each((i, el) => {
					if (el.id === 'passages') {
						throw new Error(`"StoryInterface" element <${el.nodeName.toLowerCase()} id="passages"> must not contain a "data-init-passage" content attribute`);
					}

					const passage = el.getAttribute('data-init-passage').trim();

					if (el.hasAttribute('data-passage')) {
						throw new Error(`"StoryInterface" element <${el.nodeName.toLowerCase()} data-init-passage="${passage}"> must not contain a "data-passage" content attribute`);
					}

					if (el.firstElementChild !== null) {
						throw new Error(`"StoryInterface" element <${el.nodeName.toLowerCase()} data-init-passage="${passage}"> contains child elements`);
					}

					if (Story.has(passage)) {
						jQuery(el).empty().wiki(Story.get(passage).processText().trim());
					}
				});

				// Data passage elements updated upon navigation.
				const updating = [];
				$elems.find('[data-passage]').each((i, el) => {
					if (el.id === 'passages') {
						throw new Error(`"StoryInterface" element <${el.nodeName.toLowerCase()} id="passages"> must not contain a "data-passage" content attribute`);
					}

					const passage = el.getAttribute('data-passage').trim();

					if (el.firstElementChild !== null) {
						throw new Error(`"StoryInterface" element <${el.nodeName.toLowerCase()} data-passage="${passage}"> contains child elements`);
					}

					if (Story.has(passage)) {
						updating.push({
							passage,
							element : el
						});
					}
				});

				if (updating.length > 0) {
					_updating = updating;
				}

				Config.ui.updateStoryElements = false;
			}
			else {
				$elems.append('<div id="story" role="main"><div id="passages" aria-live="polite"></div></div>');
			}

			// Insert the core UI elements into the page before the main script.
			$elems.insertBefore('body>script#script-sugarcube');
		})();

		/*
			Generate and cache the ARIA outlines <style> element (`StyleWrapper`-wrapped)
			and set up the handler to manipulate the outlines.

			IDEA: http://www.paciellogroup.com/blog/2012/04/how-to-remove-css-outlines-in-an-accessible-manner/
		*/
		_outlinePatch = new StyleWrapper((
			() => jQuery(document.createElement('style'))
				.attr({
					id   : 'style-aria-outlines',
					type : 'text/css'
				})
				.appendTo(document.head)
				.get(0) // return the <style> element itself
		)());
		_hideOutlines(); // initially hide outlines
		let _lastOutlineEvent;
		jQuery(document).on(
			'mousedown.aria-outlines keydown.aria-outlines',
			ev => {
				if (ev.type !== _lastOutlineEvent) {
					_lastOutlineEvent = ev.type;

					if (ev.type === 'keydown') {
						_showOutlines();
					}
					else {
						_hideOutlines();
					}
				}
			}
		);
	}

	/*
		Starts the story.
	*/
	function engineStart() {
		if (DEBUG) { console.log('[Engine/engineStart()]'); }

		/*
			Execute `init`-tagged special passages.
		*/
		Story.getAllInit().forEach(passage => {
			try {
				const debugBuffer = Wikifier.wikifyEval(passage.text);

				if (Config.debug) {
					const debugView = new DebugView(
						document.createDocumentFragment(),
						'special',
						`${passage.title} [init-tagged]`,
						`${passage.title} [init-tagged]`
					);
					debugView.modes({ hidden : true });
					debugView.append(debugBuffer);
					_initDebugViews.push(debugView.output);
				}
			}
			catch (ex) {
				console.error(ex);
				Alert.error(`${passage.title} [init-tagged]`, typeof ex === 'object' ? ex.message : ex);
			}
		});

		/*
			Execute the StoryInit special passage.
		*/
		if (Story.has('StoryInit')) {
			try {
				const debugBuffer = Wikifier.wikifyEval(Story.get('StoryInit').text);

				if (Config.debug) {
					const debugView = new DebugView(
						document.createDocumentFragment(),
						'special',
						'StoryInit',
						'StoryInit'
					);
					debugView.modes({ hidden : true });
					debugView.append(debugBuffer);
					_initDebugViews.push(debugView.output);
				}
				// story init executes on every game start, after all variables have been initialized
				// and also on every page reload, before the saved session is loaded
				// it's a great place to load a custom user settings script
				new Promise((resolve, reject) => {
					jQuery(document.createElement('script'))
						.one('load abort error', ev => {
							jQuery(ev.target).off();
							if (ev.type === 'load') {
								resolve(ev.target);
							}
							else {
								reject(new Error('importScripts failed to load the script "usettings.js".'));
							}
						})
						.appendTo(document.head)
						.attr({
							id   : 'script-imported-usettings.js',
							type : 'text/javascript',
							src  : 'usettings.js'
						});
				})
					.then(() => console.log('usettings.js is active'))
					.catch(() => console.log('usettings.js not active, this is normal'));
			}
			catch (ex) {
				console.error(ex);
				Alert.error('StoryInit', typeof ex === 'object' ? ex.message : ex);
			}
		}

		// Sanity checks.
		if (Config.passages.start == null) { // lazy equality for null
			throw new Error('starting passage not selected');
		}
		if (!Story.has(Config.passages.start)) {
			throw new Error(`starting passage ("${Config.passages.start}") not found`);
		}

		// Focus the document element initially.
		jQuery(document.documentElement).focus();

		/*
			Attempt to restore an active session.  Failing that, attempt to autoload the autosave,
			if requested.  Failing that, display the starting passage.
		*/
		if (State.restore()) {
			engineShow();
		}
		else {
			let loadStart = true;

			switch (typeof Config.saves.autoload) {
			case 'boolean':
				if (Config.saves.autoload && Save.autosave.ok() && Save.autosave.has()) {
					if (DEBUG) { console.log(`\tattempting autoload: "${Save.autosave.get().title}"`); }

					loadStart = !Save.autosave.load();
				}
				break;
			case 'string':
				if (Config.saves.autoload === 'prompt' && Save.autosave.ok() && Save.autosave.has()) {
					loadStart = false;
					UI.buildAutoload();
					Dialog.open();
				}
				break;
			case 'function':
				if (Save.autosave.ok() && Save.autosave.has() && !!Config.saves.autoload()) {
					if (DEBUG) { console.log(`\tattempting autoload: "${Save.autosave.get().title}"`); }

					loadStart = !Save.autosave.load();
				}
				break;
			}

			if (loadStart) {
				if (DEBUG) { console.log(`\tstarting passage: "${Config.passages.start}"`); }

				enginePlay(Config.passages.start);
			}
		}
	}

	/*
		Restarts the story.
	*/
	function engineRestart() {
		if (DEBUG) { console.log('[Engine/engineRestart()]'); }

		/*
			Show the loading screen to hide any unsightly rendering shenanigans during the
			page reload.
		*/
		LoadScreen.show();

		/*
			Scroll the window to the top.

			This is required by most browsers for the starting passage or it will remain at
			whatever its current scroll position is after the page reload.  We do it generally,
			rather than only for the currently set starting passage, since the starting passage
			may be dynamically manipulated.
		*/
		window.scroll(0, 0);

		/*
			Delete the active session.
		*/
		State.reset();

		/*
			Trigger an ':enginerestart' event.
		*/
		jQuery.event.trigger(':enginerestart');

		/*
			Reload the page.
		*/
		window.location.reload();
	}

	/*
		Returns the current state of the engine.
	*/
	function engineState() {
		return _state;
	}

	/*
		Returns whether the engine is idle.
	*/
	function engineIsIdle() {
		return _state === States.Idle;
	}

	/*
		Returns whether the engine is playing.
	*/
	function engineIsPlaying() {
		return _state !== States.Idle;
	}

	/*
		Returns whether the engine is rendering.
	*/
	function engineIsRendering() {
		return _state === States.Rendering;
	}

	/*
		Returns a timestamp representing the last time `Engine.play()` was called.
	*/
	function engineLastPlay() {
		return _lastPlay;
	}

	/*
		Activate the moment at the given index within the state history and show it.
	*/
	function engineGoTo(idx) {
		const succeded = State.goTo(idx);

		if (succeded) {
			engineShow();
		}

		return succeded;
	}

	/*
		Activate the moment at the given offset from the active moment within the state history
		and show it.
	*/
	function engineGo(offset) {
		const succeded = State.go(offset);

		if (succeded) {
			engineShow();
		}

		return succeded;
	}

	/*
		Go to the moment which directly precedes the active moment and show it.
	*/
	function engineBackward() {
		return engineGo(-1);
	}

	/*
		Go to the moment which directly follows the active moment and show it.
	*/
	function engineForward() {
		return engineGo(1);
	}

	/*
		Renders and displays the active (present) moment's associated passage without adding
		a new moment to the history.
	*/
	function engineShow() {
		return enginePlay(State.passage, true);
	}

	/*
		Renders and displays the passage referenced by the given title, optionally without
		adding a new moment to the history.
	*/
	function enginePlay(title, noHistory) {
		if (DEBUG) { console.log(`[Engine/enginePlay(title: "${title}", noHistory: ${noHistory})]`); }

		let passageTitle = title;

		// Update the engine state.
		_state = States.Playing;

		// Reset the temporary state and variables objects.
		TempState = {}; // eslint-disable-line no-undef
		State.clearTemporary();

		// Debug view setup.
		let passageReadyOutput;
		let passageDoneOutput;

		// Execute the navigation override callback.
		if (typeof Config.navigation.override === 'function') {
			try {
				const overrideTitle = Config.navigation.override(passageTitle);

				if (overrideTitle) {
					passageTitle = overrideTitle;
				}
			}
			catch (ex) { /* no-op */ }
		}

		// Retrieve the passage by the given title.
		//
		// NOTE: The values of the `title` parameter and `passageTitle` variable
		// may be empty, strings, or numbers (though using a number as reference
		// to a numeric title should be discouraged), so after loading the passage,
		// always refer to `passage.title` and never to the others.
		const passage = Story.get(passageTitle);

		// Execute the pre-history events and tasks.
		jQuery.event.trigger({
			type : ':passageinit',
			passage
		});
		Object.keys(prehistory).forEach(task => {
			if (typeof prehistory[task] === 'function') {
				prehistory[task].call(passage, task);
			}
		});

		// Create a new entry in the history.
		if (!noHistory) {
			State.create(passage.title);
		}

		// Clear the document body's classes.
		if (document.body.className) {
			document.body.className = '';
		}

		// Update the last play time.
		//
		// NOTE: This is mostly for event, task, and special passage code,
		// though the likelihood of it being needed this early is low.  This
		// will be updated again later at the end.
		_lastPlay = Util.now();

		// Execute pre-display tasks and the `PassageReady` special passage.
		Object.keys(predisplay).forEach(task => {
			if (typeof predisplay[task] === 'function') {
				predisplay[task].call(passage, task);
			}
		});

		if (Story.has('PassageReady')) {
			try {
				passageReadyOutput = Wikifier.wikifyEval(Story.get('PassageReady').text);
			}
			catch (ex) {
				console.error(ex);
				Alert.error('PassageReady', ex.message);
			}
		}

		// Update the engine state.
		_state = States.Rendering;

		// Get the passage's tags as a string, or `null` if there aren't any.
		const dataTags = passage.tags.length > 0 ? passage.tags.join(' ') : null;

		// Create and set up the incoming passage element.
		const passageEl = document.createElement('div');
		jQuery(passageEl)
			.attr({
				id             : passage.domId,
				'data-passage' : passage.title,
				'data-tags'    : dataTags
			})
			.addClass(`passage ${passage.className}`);

		// Add the passage's classes and tags to the document body.
		jQuery(document.body)
			.attr('data-tags', dataTags)
			.addClass(passage.className);

		// Add the passage's tags to the document element.
		jQuery(document.documentElement)
			.attr('data-tags', dataTags);

		// Execute pre-render events and tasks.
		jQuery.event.trigger({
			type    : ':passagestart',
			content : passageEl,
			passage
		});
		Object.keys(prerender).forEach(task => {
			if (typeof prerender[task] === 'function') {
				prerender[task].call(passage, passageEl, task);
			}
		});

		// Render the `PassageHeader` passage, if it exists, into the passage element.
		if (Story.has('PassageHeader')) {
			new Wikifier(passageEl, Story.get('PassageHeader').processText());
		}

		// Render the passage into its element.
		passageEl.appendChild(passage.render());

		// Render the `PassageFooter` passage, if it exists, into the passage element.
		if (Story.has('PassageFooter')) {
			new Wikifier(passageEl, Story.get('PassageFooter').processText());
		}

		// Execute post-render events and tasks.
		jQuery.event.trigger({
			type    : ':passagerender',
			content : passageEl,
			passage
		});
		Object.keys(postrender).forEach(task => {
			if (typeof postrender[task] === 'function') {
				postrender[task].call(passage, passageEl, task);
			}
		});

		// Cache the passage container.
		const containerEl = document.getElementById('passages');

		// Empty the passage container.
		if (containerEl.hasChildNodes()) {
			if (
				   typeof Config.passages.transitionOut === 'number'
				|| typeof Config.passages.transitionOut === 'string'
				&& Config.passages.transitionOut !== ''
				&& Has.transitionEndEvent
			) {
				[...containerEl.childNodes].forEach(outgoing => {
					const $outgoing = jQuery(outgoing);

					if (outgoing.nodeType === Node.ELEMENT_NODE && $outgoing.hasClass('passage')) {
						if ($outgoing.hasClass('passage-out')) {
							return;
						}

						$outgoing
							.attr({
								id          : `out-${$outgoing.attr('id')}`,
								'aria-live' : 'off'
							})
							.addClass('passage-out');

						if (typeof Config.passages.transitionOut === 'string') {
							$outgoing.on(Has.transitionEndEvent, ev => {
								if (ev.propertyName === Config.passages.transitionOut) {
									$outgoing.remove();
								}
							});
						}
						else {
							setTimeout(
								() => $outgoing.remove(),
								Math.max(minDomActionDelay, Config.passages.transitionOut)
							);
						}
					}
					else {
						$outgoing.remove();
					}
				});
			}
			else {
				jQuery(containerEl).empty();
			}
		}

		// Append the passage element to the passage container and set up its transition.
		jQuery(passageEl)
			.addClass('passage-in')
			.appendTo(containerEl);
		setTimeout(() => jQuery(passageEl).removeClass('passage-in'), minDomActionDelay);

		// Update the story display title, if necessary.
		if (Story.has('StoryDisplayTitle')) {
			// NOTE: We don't have an `else` here because that case will be handled later (below).
			if (_updating !== null || !Config.ui.updateStoryElements) {
				setDisplayTitle(Story.get('StoryDisplayTitle').processText());
			}
		}
		else if (Config.passages.displayTitles && passage.title !== Config.passages.start) {
			document.title = `${passage.title} | ${Story.title}`;
		}

		// Scroll the window to the top.
		window.scroll(0, 0);

		// Update the engine state.
		_state = States.Playing;

		// Execute post-display events, tasks, and the `PassageDone` special passage.
		if (Story.has('PassageDone')) {
			try {
				passageDoneOutput = Wikifier.wikifyEval(Story.get('PassageDone').text);
			}
			catch (ex) {
				console.error(ex);
				Alert.error('PassageDone', ex.message);
			}
		}

		jQuery.event.trigger({
			type    : ':passagedisplay',
			content : passageEl,
			passage
		});
		Object.keys(postdisplay).forEach(task => {
			if (typeof postdisplay[task] === 'function') {
				postdisplay[task].call(passage, task);
			}
		});

		// Update the other interface elements, if necessary.
		if (_updating !== null) {
			_updating.forEach(pair => {
				jQuery(pair.element).empty();
				new Wikifier(pair.element, Story.get(pair.passage).processText().trim());
			});
		}
		else if (Config.ui.updateStoryElements) {
			UIBar.update();
		}

		// Add the completed debug views for `StoryInit`, `PassageReady`, and `PassageDone`
		// to the incoming passage element.
		if (Config.debug) {
			let debugView;

			// Prepend the `PassageReady` debug view.
			if (passageReadyOutput != null) { // lazy equality for null
				debugView = new DebugView(
					document.createDocumentFragment(),
					'special',
					'PassageReady',
					'PassageReady'
				);
				debugView.modes({ hidden : true });
				debugView.append(passageReadyOutput);
				jQuery(passageEl).prepend(debugView.output);
			}

			// Append the `PassageDone` debug view.
			if (passageDoneOutput != null) { // lazy equality for null
				debugView = new DebugView(
					document.createDocumentFragment(),
					'special',
					'PassageDone',
					'PassageDone'
				);
				debugView.modes({ hidden : true });
				debugView.append(passageDoneOutput);
				jQuery(passageEl).append(debugView.output);
			}

			// Prepend the cached initialization debug views, if we're showing the first moment/turn.
			if (State.turns === 1 && _initDebugViews.length > 0) {
				jQuery(passageEl).prepend(_initDebugViews);
			}
		}

		// Last second post-processing for accessibility and other things.
		jQuery('#story')
			// Add `link-external` to all `href` bearing `<a>` elements which don't have it.
			.find('a[href]:not(.link-external)')
			.addClass('link-external')
			.end()
			// Add `tabindex=0` to all interactive elements which don't have it.
			.find('a,link,button,input,select,textarea')
			.not('[tabindex]')
			.attr('tabindex', 0);

		// Handle autosaves.
		switch (typeof Config.saves.autosave) {
		case 'boolean':
			if (Config.saves.autosave) {
				Save.autosave.save();
			}
			break;
		case 'object':
			if (passage.tags.some(tag => Config.saves.autosave.includes(tag))) {
				Save.autosave.save();
			}
			break;
		case 'function':
			if (Config.saves.autosave()) {
				Save.autosave.save();
			}
			break;
		}

		// Execute post-play events.
		jQuery.event.trigger({
			type    : ':passageend',
			content : passageEl,
			passage
		});

		// Reset the engine state.
		_state = States.Idle;

		// Update the last play time.
		_lastPlay = Util.now();

		return passageEl;
	}


	/*******************************************************************************************************************
		Legacy Functions.
	*******************************************************************************************************************/
	/*
		[DEPRECATED] Play the given passage, optionally without altering the history.
	*/
	function engineDisplay(title, link, option) {
		if (DEBUG) { console.log('[Engine/engineDisplay()]'); }

		let noHistory = false;

		// Process the option parameter.
		switch (option) {
		case undefined:
			/* no-op */
			break;

		case 'replace':
		case 'back':
			noHistory = true;
			break;

		default:
			throw new Error(`Engine.display option parameter called with obsolete value "${option}"; please notify the developer`);
		}

		enginePlay(title, noHistory);
	}


	/*******************************************************************************************************************
		Utility Functions.
	*******************************************************************************************************************/
	function _hideOutlines() {
		_outlinePatch.set('*:focus{outline:none;}');
	}

	function _showOutlines() {
		_outlinePatch.clear();
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Constants.
		*/
		States            : { value : States },
		minDomActionDelay : { value : minDomActionDelay },

		/*
			Core Functions.
		*/
		init        : { value : engineInit },
		start       : { value : engineStart },
		restart     : { value : engineRestart },
		state       : { get : engineState },
		isIdle      : { value : engineIsIdle },
		isPlaying   : { value : engineIsPlaying },
		isRendering : { value : engineIsRendering },
		lastPlay    : { get : engineLastPlay },
		goTo        : { value : engineGoTo },
		go          : { value : engineGo },
		backward    : { value : engineBackward },
		forward     : { value : engineForward },
		show        : { value : engineShow },
		play        : { value : enginePlay },

		/*
			Legacy Functions.
		*/
		display : { value : engineDisplay }
	}));
})();

/***********************************************************************************************************************

	passage.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Config, L10n, Util, Wikifier */

var Passage = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	let _tagsToSkip;
	let _twine1Unescape;

	/*
		Tags which should not be transformed into classes:
			debug      → special tag
			nobr       → special tag
			passage    → the default class
			script     → special tag (only in Twine 1)
			stylesheet → special tag (only in Twine 1)
			twine.*    → special tag
			widget     → special tag
	*/
	// For Twine 1
	if (TWINE1) {
		_tagsToSkip = /^(?:debug|nobr|passage|script|stylesheet|widget|twine\..*)$/i;
	}
	// For Twine 2
	else {
		_tagsToSkip = /^(?:debug|nobr|passage|widget|twine\..*)$/i;
	}

	// For Twine 1
	if (TWINE1) {
		/*
			Returns a decoded version of the passed Twine 1 passage store encoded string.
		*/
		const _twine1EscapesRe    = /(?:\\n|\\t|\\s|\\|\r)/g;
		const _hasTwine1EscapesRe = new RegExp(_twine1EscapesRe.source); // to drop the global flag
		const _twine1EscapesMap   = Object.freeze({
			'\\n' : '\n',
			'\\t' : '\t',
			'\\s' : '\\',
			'\\'  : '\\',
			'\r'  : ''
		});

		_twine1Unescape = function (str) {
			if (str == null) { // lazy equality for null
				return '';
			}

			const val = String(str);
			return val && _hasTwine1EscapesRe.test(val)
				? val.replace(_twine1EscapesRe, esc => _twine1EscapesMap[esc])
				: val;
		};
	}


	/*******************************************************************************************************************
		Passage Class.
	*******************************************************************************************************************/
	class Passage {
		constructor(title, el) {
			Object.defineProperties(this, {
				// Passage title/ID.
				title : {
					value : Util.unescape(title)
				},

				// Passage data element (within the story data element; i.e. T1: '[tiddler]', T2: 'tw-passagedata').
				element : {
					value : el || null
				},

				// Passage tags array (unique).
				tags : {
					value : Object.freeze(
						el && el.hasAttribute('tags')
							? Array.from(new Set(el.getAttribute('tags').trim().splitOrEmpty(/\s+/)))
							: []
					)
				},

				// Passage excerpt.  Used by the `description()` method.
				_excerpt : {
					writable : true,
					value    : null
				}
			});

			// Properties dependant upon the above set.
			Object.defineProperties(this, {
				// Passage DOM-compatible ID.
				domId : {
					value : `passage-${Util.slugify(this.title)}`
				},

				// Passage classes array (sorted and unique).
				classes : {
					value : Object.freeze(this.tags.length === 0 ? [] : (() =>
						/*
							Return the sorted list of unique classes.

							NOTE: The `this.tags` array is already sorted and unique,
							so we only need to filter and map here.
						*/
						this.tags
							.filter(tag => !_tagsToSkip.test(tag))
							.map(tag => Util.slugify(tag))
					)())
				}
			});
		}

		// Getters.
		get className() {
			return this.classes.join(' ');
		}

		// TODO: (v3) This should be → `get source`.
		get text() {
			if (this.element == null) { // lazy equality for null
				const passage = Util.escapeMarkup(this.title);
				const mesg    = `${L10n.get('errorTitle')}: ${L10n.get('errorNonexistentPassage', { passage })}`;
				return `<div class="error-view"><span class="error">${mesg}</span></div>`;
			}

			// For Twine 1
			if (TWINE1) {
				return _twine1Unescape(this.element.textContent);
			}
			// For Twine 2
			else { // eslint-disable-line no-else-return
				return this.element.textContent.replace(/\r/g, '');
			}
		}

		description() {
			const descriptions = Config.passages.descriptions;

			switch (typeof descriptions) {
			case 'boolean':
				if (descriptions) {
					return this.title;
				}
				break;

			case 'object':
				if (descriptions.hasOwnProperty(this.title)) {
					return descriptions[this.title];
				}
				break;

			case 'function':
				{
					const result = descriptions.call(this);

					if (result) {
						return result;
					}
				}
				break;
			}

			// Initialize the excerpt cache from the raw passage text, if necessary.
			if (this._excerpt === null) {
				this._excerpt = Passage.getExcerptFromText(this.text);
			}

			return this._excerpt;
		}

		// TODO: (v3) This should be → `get text`.
		processText() {
			if (this.element == null) { // lazy equality for null
				return this.text;
			}

			// Handle image passage transclusion.
			if (this.tags.includes('Twine.image')) {
				return `[img[${this.text}]]`;
			}

			let processed = this.text;

			// Handle `Config.passages.onProcess`.
			if (Config.passages.onProcess) {
				processed = Config.passages.onProcess.call(null, {
					title : this.title,
					tags  : this.tags,
					text  : processed
				});
			}

			// Handle `Config.passages.nobr` and the `nobr` tag.
			if (Config.passages.nobr || this.tags.includes('nobr')) {
				// Remove all leading & trailing newlines and compact all internal sequences
				// of newlines into single spaces.
				processed = processed.replace(/^\n+|\n+$/g, '').replace(/\n+/g, ' ');
			}

			// Reset stopWikify flag at the end of a passage
			Wikifier.stopWikify = 0;

			return processed;
		}

		render(options) {
			// Wikify the passage into a document fragment.
			const frag = document.createDocumentFragment();
			new Wikifier(frag, this.processText(), options);

			// Update the excerpt cache to reflect the rendered text, if we need it for the passage description
			if (Config.passages.descriptions == null) {
				this._excerpt = Passage.getExcerptFromNode(frag);
			}

			return frag;
		}

		static getExcerptFromNode(node, count) {
			if (DEBUG) { console.log(`[Passage.getExcerptFromNode(node=…, count=${count})]`, node); }

			if (!node.hasChildNodes()) {
				return '';
			}

			// WARNING: es5-shim's `<String>.trim()` can cause "too much recursion" errors
			// here on very large strings (e.g., ≥40 KiB), at least in Firefox, for unknown
			// reasons.
			//
			// To fix the issue, we're removed `\u180E` from es5-shim's whitespace pattern
			// to prevent it from erroneously shimming `<String>.trim()` in the first place.
			let excerpt = node.textContent.trim();

			if (excerpt !== '') {
				const excerptRe = new RegExp(`(\\S+(?:\\s+\\S+){0,${count > 0 ? count - 1 : 7}})`);
				excerpt = excerpt
					// Compact whitespace.
					.replace(/\s+/g, ' ')
					// Attempt to match the excerpt regexp.
					.match(excerptRe);
			}

			return excerpt ? `${excerpt[1]}\u2026` : '\u2026'; // horizontal ellipsis
		}

		static getExcerptFromText(text, count) {
			if (DEBUG) { console.log(`[Passage.getExcerptFromText(text=…, count=${count})]`, text); }

			if (text === '') {
				return '';
			}

			const excerptRe = new RegExp(`(\\S+(?:\\s+\\S+){0,${count > 0 ? count - 1 : 7}})`);
			const excerpt   = text
				// Strip macro tags (replace with a space).
				.replace(/<<.*?>>/g, ' ')
				// Strip html tags (replace with a space).
				.replace(/<.*?>/g, ' ')
				// The above might have left problematic whitespace, so trim.
				.trim()
				// Strip table markup.
				.replace(/^\s*\|.*\|.*?$/gm, '')
				// Strip image markup.
				.replace(/\[[<>]?img\[[^\]]*\]\]/g, '')
				// Clean link markup (remove all but the link text).
				.replace(/\[\[([^|\]]*?)(?:(?:\||->|<-)[^\]]*)?\]\]/g, '$1')
				// Clean heading markup.
				.replace(/^\s*!+(.*?)$/gm, '$1')
				// Clean bold/italic/underline/highlight styles.
				.replace(/'{2}|\/{2}|_{2}|@{2}/g, '')
				// A final trim.
				.trim()
				// Compact whitespace.
				.replace(/\s+/g, ' ')
				// Attempt to match the excerpt regexp.
				.match(excerptRe);
			return excerpt ? `${excerpt[1]}\u2026` : '\u2026'; // horizontal ellipsis
		}
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Passage;
})();

/***********************************************************************************************************************

	save.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Config, Dialog, Engine, L10n, State, Story, UI, Util, storage, idb */

var Save = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Save operation type pseudo-enumeration.
	const Type = Util.toEnum({
		Autosave  : 'autosave',
		Disk      : 'disk',
		Serialize : 'serialize',
		Slot      : 'slot'
	});

	// The upper bound of the saves slots.
	let _slotsUBound = -1;

	// extra save metadata
	let _meta = {};

	// Set of onLoad handlers.
	const _onLoadHandlers = new Set();

	// Set of onSave handlers.
	const _onSaveHandlers = new Set();


	/********************************
		split save stuff
	********************************/
	let useSplit = () => Story.domId === 'free-cities'; // todo: make it a proper toggle
	function indexGet() {
		return storage.get('index') ?? savesObjCreate();
	}

	function splitSave(slot, data) {
		storage.set(slot === 'autosave' ? slot : `slot${slot}`, data);
		const index = indexGet();
		delete data.state;
		slot === 'autosave' ? index.autosave = data : index.slots[slot] = data;
		try {
			storage.set('index', index);
		}
		catch (ex) {
			storage.delete(slot === 'autosave' ? 'autosave' : `slot${slot}`);
			// eslint-disable-next-line no-alert
			alert('Storage quota exceeded, try removing other saves first');
		}

		return true;
	}

	function splitDelete(slot) {
		storage.delete(slot === 'autosave' ? slot : `slot${slot}`);
		const index = indexGet();
		slot === 'autosave' ? index.autosave = null : index.slots[slot] = null;
		storage.set('index', index);
		return true;
	}

	/*******************************************************************************************************************
		Saves Functions.
	*******************************************************************************************************************/
	function savesInit() {
		if (DEBUG) { console.log('[Save/savesInit()]'); }

		// Disable save slots and the autosave when Web Storage is unavailable.
		if (storage.name === 'cookie') {
			savesObjClear();
			Config.saves.autoload = undefined;
			Config.saves.autosave = undefined;
			Config.saves.slots = 0;
			return false;
		}

		let saves   = savesObjGet();
		let updated = false;

		// Handle the author changing the number of save slots.
		if (Config.saves.slots !== saves.slots.length) {
			if (Config.saves.slots < saves.slots.length) {
				// Attempt to decrease the number of slots; this will only compact
				// the slots array, by removing empty slots, no saves will be deleted.
				saves.slots.reverse();

				saves.slots = saves.slots.filter(function (val) {
					if (val === null && this.count > 0) {
						--this.count;
						return false;
					}

					return true;
				}, { count : saves.slots.length - Config.saves.slots });

				saves.slots.reverse();
			}
			else if (Config.saves.slots > saves.slots.length) {
				// Attempt to increase the number of slots.
				_appendSlots(saves.slots, Config.saves.slots - saves.slots.length);
			}

			updated = true;
		}

		// If the saves object was updated, then update the store.
		if (updated) {
			_savesObjSave(saves);
		}

		_slotsUBound = saves.slots.length - 1;

		return true;
	}

	function savesObjCreate() {
		return {
			autosave : null,
			slots    : _appendSlots([], Config.saves.slots)
		};
	}

	function savesObjGet() {
		const saves = storage.get(useSplit() ? 'index' : 'saves');
		return saves === null ? savesObjCreate() : saves;
	}

	function savesObjClear() {
		storage.delete('saves');
		if (useSplit()) {
			storage.delete('index');
			storage.delete('autosave');
			for (let i = 0; i < Config.save.slots - 1; i++) storage.delete(`slot${i}`);
		}
		return true;
	}

	function savesOk() {
		return autosaveOk() || slotsOk();
	}


	/*******************************************************************************************************************
		Autosave Functions.
	*******************************************************************************************************************/
	function autosaveOk() {
		return storage.name !== 'cookie' && typeof Config.saves.autosave !== 'undefined';
	}

	function autosaveHas() {
		const saves = useSplit() ? { autosave : storage.get('autosave') } : savesObjGet();

		if (saves.autosave === null) {
			return false;
		}

		return true;
	}

	function autosaveGet() {
		const saves = useSplit() ? { autosave : storage.get('autosave') } : savesObjGet();
		return saves.autosave;
	}

	function autosaveLoad() {
		// idb intercept
		if (idb.active) {
			idb.loadState(0);
			return true;
		}

		const saves = useSplit() ? { autosave : storage.get('autosave') } : savesObjGet();

		if (saves.autosave === null) {
			return false;
		}

		return _unmarshal(saves.autosave);
	}

	function autosaveSave(title, metadata) {
		if (typeof Config.saves.isAllowed === 'function' && !Config.saves.isAllowed()) {
			return false;
		}

		// idb intercept
		if (idb.active) {
			idb.saveState(0, title, metadata);
			return true;
		}

		const saves        = savesObjGet();
		const supplemental = {
			title : title || Story.get(State.passage).description(),
			date  : Date.now()
		};

		if (metadata != null) { // lazy equality for null
			supplemental.metadata = metadata;
		}

		const saveData = _marshal(supplemental, { type : Type.Autosave });
		if (useSplit()) return splitSave('autosave', saveData);
		saves.autosave = saveData;

		return _savesObjSave(saves);
	}

	function autosaveDelete() {
		if (useSplit()) return splitDelete('autosave');

		const saves = savesObjGet();
		saves.autosave = null;
		return _savesObjSave(saves);
	}


	/*******************************************************************************************************************
		Slots Functions.
	*******************************************************************************************************************/
	function slotsOk() {
		return storage.name !== 'cookie' && _slotsUBound !== -1;
	}

	function slotsLength() {
		return _slotsUBound + 1;
	}

	function slotsCount() {
		if (!slotsOk()) {
			return 0;
		}

		const saves = savesObjGet();
		let count = 0;

		for (let i = 0, iend = saves.slots.length; i < iend; ++i) {
			if (saves.slots[i] !== null) {
				++count;
			}
		}
		return count;
	}

	function slotsIsEmpty() {
		return slotsCount() === 0;
	}

	function slotsHas(slot) {
		if (slot < 0 || slot > _slotsUBound) {
			return false;
		}

		const saves = savesObjGet();

		if (slot >= saves.slots.length || saves.slots[slot] === null) {
			return false;
		}

		return true;
	}

	function slotsGet(slot) {
		if (slot < 0 || slot > _slotsUBound) {
			return null;
		}

		const saves = savesObjGet();

		if (slot >= saves.slots.length) {
			return null;
		}

		return useSplit() ? storage.get(`slot${slot}`) : saves.slots[slot];
	}

	function slotsLoad(slot) {
		if (slot < 0 || slot > _slotsUBound) {
			return false;
		}

		const saves = savesObjGet();

		if (slot >= saves.slots.length || saves.slots[slot] === null) {
			return false;
		}

		return _unmarshal(useSplit() ? storage.get(`slot${slot}`) : saves.slots[slot]);
	}

	function slotsSave(slot, title, metadata) {
		if (typeof Config.saves.isAllowed === 'function' && !Config.saves.isAllowed()) {
			if (Dialog.isOpen()) {
				$(document).one(':dialogclosed', () => UI.alert(L10n.get('savesDisallowed')));
			}
			else {
				UI.alert(L10n.get('savesDisallowed'));
			}

			return false;
		}

		if (slot < 0 || slot > _slotsUBound) {
			return false;
		}

		const saves = savesObjGet();

		if (slot >= saves.slots.length) {
			return false;
		}

		const supplemental = {
			title : title || Story.get(State.passage).description(),
			date  : Date.now()
		};

		if (metadata != null) { // lazy equality for null
			supplemental.metadata = metadata;
		}

		const saveData = _marshal(supplemental, { type : Type.Slot });
		if (useSplit()) return splitSave(slot, saveData);

		saves.slots[slot] = saveData;

		return _savesObjSave(saves);
	}

	function slotsDelete(slot) {
		if (slot < 0 || slot > _slotsUBound) {
			return false;
		}

		const saves = savesObjGet();

		if (slot >= saves.slots.length) {
			return false;
		}

		if (useSplit()) return splitDelete(slot);

		saves.slots[slot] = null;
		return _savesObjSave(saves);
	}


	/*******************************************************************************************************************
		Disk Import/Export Functions.
	*******************************************************************************************************************/
	function exportToDisk(filename, metadata) {
		if (typeof Config.saves.isAllowed === 'function' && !Config.saves.isAllowed()) {
			if (Dialog.isOpen()) {
				$(document).one(':dialogclosed', () => UI.alert(L10n.get('savesDisallowed')));
			}
			else {
				UI.alert(L10n.get('savesDisallowed'));
			}

			return;
		}

		function getDatestamp() {
			const now = new Date();
			let MM = now.getMonth() + 1;
			let DD = now.getDate();
			let hh = now.getHours();
			let mm = now.getMinutes();
			let ss = now.getSeconds();

			if (MM < 10) { MM = `0${MM}`; }
			if (DD < 10) { DD = `0${DD}`; }
			if (hh < 10) { hh = `0${hh}`; }
			if (mm < 10) { mm = `0${mm}`; }
			if (ss < 10) { ss = `0${ss}`; }

			return `${now.getFullYear()}${MM}${DD}-${hh}${mm}${ss}`;
		}

		function getFilename(str) {
			return Util.sanitizeFilename(str)
				.replace(/[_\s\u2013\u2014-]+/g, '-'); // legacy
		}

		const baseName     = filename == null ? Story.domId : getFilename(filename); // lazy equality for null
		const saveName     = `${baseName}-${getDatestamp()}.save`;
		const supplemental = metadata == null ? {} : { metadata }; // lazy equality for null
		const data         = LZString.compressToBase64(JSON.stringify(_marshal(supplemental, { type : Type.Disk })));
		const saveObj      = data + LZString.compressToBase64(JSON.stringify({ [Story.domId] : data.length }));
		saveAs(new Blob([saveObj], { type : 'text/plain;charset=UTF-8' }), saveName);
	}

	function importFromDisk(event) {
		const file   = event.target.files[0];
		const reader = new FileReader();

		// Add the handler that will capture the file information once the load is finished.
		jQuery(reader).one('loadend', () => {
			if (reader.error) {
				const ex = reader.error;
				UI.alert(`${L10n.get('errorSaveDiskLoadFailed').toUpperFirst()} (${ex.name}: ${ex.message}).</p><p>${L10n.get('aborting')}.`);
				return;
			}

			deserialize(reader.result);
		});

		// Initiate the file load.
		reader.readAsText(file);
	}


	/*******************************************************************************************************************
		Serialization Functions.
	*******************************************************************************************************************/
	function serialize(metadata) {
		if (typeof Config.saves.isAllowed === 'function' && !Config.saves.isAllowed()) {
			if (Dialog.isOpen()) {
				$(document).one(':dialogclosed', () => UI.alert(L10n.get('savesDisallowed')));
			}
			else {
				UI.alert(L10n.get('savesDisallowed'));
			}

			return null;
		}

		const supplemental = metadata == null ? {} : { metadata }; // lazy equality for null
		supplemental.idx = State.qc;
		const data = LZString.compressToBase64(JSON.stringify(_marshal(supplemental, { type : Type.Serialize })));
		return data + LZString.compressToBase64(JSON.stringify({ [Story.domId] : data.length }));
	}

	function deserialize(base64Str) {
		/*
			NOTE: We purposefully do not attempt to catch parameter shenanigans
			here, instead relying on `_unmarshal()` to do the heavy lifting.
		*/

		let saveObj;

		try {
			const jsonstring = LZString.decompressFromBase64(base64Str);
			const offset = LZString.compressToBase64(jsonstring).length;
			const metadata = JSON.parse(LZString.decompressFromBase64(base64Str.slice(offset)));
			_meta = metadata;
			saveObj = JSON.parse(jsonstring);
			if (_meta?.[Story.domId] !== offset) saveObj.idx += '';
		}
		catch (ex) { /* no-op; `_unmarshal()` will handle the error */ }

		if (!_unmarshal(saveObj, 'file')) {
			return null;
		}

		return saveObj.metadata;
	}


	/*******************************************************************************************************************
		Event Functions.
	*******************************************************************************************************************/
	function onLoadAdd(handler) {
		const valueType = Util.getType(handler);

		if (valueType !== 'function') {
			throw new TypeError(`Save.onLoad.add handler parameter must be a function (received: ${valueType})`);
		}

		_onLoadHandlers.add(handler);
	}

	function onLoadClear() {
		_onLoadHandlers.clear();
	}

	function onLoadDelete(handler) {
		return _onLoadHandlers.delete(handler);
	}

	function onLoadSize() {
		return _onLoadHandlers.size;
	}

	function onSaveAdd(handler) {
		const valueType = Util.getType(handler);

		if (valueType !== 'function') {
			throw new TypeError(`Save.onSave.add handler parameter must be a function (received: ${valueType})`);
		}

		_onSaveHandlers.add(handler);
	}

	function onSaveClear() {
		_onSaveHandlers.clear();
	}

	function onSaveDelete(handler) {
		return _onSaveHandlers.delete(handler);
	}

	function onSaveSize() {
		return _onSaveHandlers.size;
	}


	/*******************************************************************************************************************
		Utility Functions.
	*******************************************************************************************************************/
	function _appendSlots(array, num) {
		for (let i = 0; i < num; ++i) {
			array.push(null);
		}

		return array;
	}

	function _savesObjIsEmpty(saves) {
		const slots = saves.slots;
		let isSlotsEmpty = true;

		for (let i = 0, iend = slots.length; i < iend; ++i) {
			if (slots[i] !== null) {
				isSlotsEmpty = false;
				break;
			}
		}

		return saves.autosave === null && isSlotsEmpty;
	}

	function _savesObjSave(saves) {
		if (_savesObjIsEmpty(saves)) {
			storage.delete('saves');
			return true;
		}

		return storage.set('saves', saves);
	}

	function _marshal(supplemental, details) {
		if (DEBUG) { console.log(`[Save/_marshal(…, { type : '${details.type}' })]`); }

		if (supplemental != null && typeof supplemental !== 'object') { // lazy equality for null
			throw new Error('supplemental parameter must be an object');
		}

		const saveObj = Object.assign({}, supplemental, {
			id    : Config.saves.id,
			state : State.marshalForSave(),
			idx   : State.qc
		});

		if (Config.saves.version) {
			saveObj.version = Config.saves.version;
		}

		_onSaveHandlers.forEach(fn => fn(saveObj, details));

		// Delta encode the state history and delete the non-encoded property.
		saveObj.state.delta = State.deltaEncode(saveObj.state.history);
		delete saveObj.state.history;

		return saveObj;
	}

	function _unmarshal(saveObj) {
		if (DEBUG) { console.log('[Save/_unmarshal()]'); }

		try {
			/* eslint-disable no-param-reassign */

			if (!saveObj || !saveObj.hasOwnProperty('id') || !saveObj.hasOwnProperty('state')) {
				throw new Error(L10n.get('errorSaveMissingData'));
			}

			// Delta decode the state history and delete the encoded property.
			if (!saveObj.state.history) {
				if (saveObj.state.jdelta) delete saveObj.state.jdelta;
				if (saveObj.state.delta) saveObj.state.history = State.deltaDecode(saveObj.state.delta);
				delete saveObj.state.delta;
			}

			_onLoadHandlers.forEach(fn => fn(saveObj));

			if (saveObj.id !== Config.saves.id) throw new Error(L10n.get('errorSaveIdMismatch'));
			saveObj.state.idx = saveObj.idx || '';

			// Restore the state.
			State.unmarshalForSave(saveObj.state); // may also throw exceptions

			// Show the active moment.
			Engine.show();
			/* eslint-enable no-param-reassign */
		}
		catch (ex) {
			UI.alert(`${ex.message.toUpperFirst()}.</p><p>${L10n.get('aborting')}.`);
			return false;
		}

		return true;
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Save Functions.
		*/
		init  : { value : savesInit },
		get   : { value : savesObjGet },
		clear : { value : savesObjClear },
		ok    : { value : savesOk },

		/*
			Autosave Functions.
		*/
		autosave : {
			value : Object.freeze(Object.defineProperties({}, {
				ok     : { value : autosaveOk },
				has    : { value : autosaveHas },
				get    : { value : autosaveGet },
				load   : { value : autosaveLoad },
				save   : { value : autosaveSave },
				delete : { value : autosaveDelete }
			}))
		},

		/*
			Slots Functions.
		*/
		slots : {
			value : Object.freeze(Object.defineProperties({}, {
				ok      : { value : slotsOk },
				length  : { get : slotsLength },
				isEmpty : { value : slotsIsEmpty },
				count   : { value : slotsCount },
				has     : { value : slotsHas },
				get     : { value : slotsGet },
				load    : { value : slotsLoad },
				save    : { value : slotsSave },
				delete  : { value : slotsDelete }
			}))
		},

		/*
			Disk Import/Export Functions.
		*/
		export : { value : exportToDisk },
		import : { value : importFromDisk },

		/*
			Serialization Functions.
		*/
		serialize   : { value : serialize },
		deserialize : { value : deserialize },

		/*
			Event Functions.
		*/
		onLoad : {
			value : Object.freeze(Object.defineProperties({}, {
				add      : { value : onLoadAdd },
				clear    : { value : onLoadClear },
				delete   : { value : onLoadDelete },
				size     : { get : onLoadSize },
				handlers : { value : _onLoadHandlers }
			}))
		},
		onSave : {
			value : Object.freeze(Object.defineProperties({}, {
				add      : { value : onSaveAdd },
				clear    : { value : onSaveClear },
				delete   : { value : onSaveDelete },
				size     : { get : onSaveSize },
				handlers : { value : _onSaveHandlers }
			}))
		},
		meta : { get : () => _meta }
	}));
})();

/***********************************************************************************************************************

	setting.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Util, settings:true, storage */

var Setting = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Setting control types object (pseudo-enumeration).
	const Types = Util.toEnum({
		Header : 0,
		Toggle : 1,
		List   : 2,
		Range  : 3
	});

	// Setting definition array.
	const _definitions = [];


	/*******************************************************************************************************************
		Settings Functions.
	*******************************************************************************************************************/
	function settingsInit() {
		if (DEBUG) { console.log('[Setting/settingsInit()]'); }

		/* legacy */
		// Attempt to migrate an existing `options` store to `settings`.
		if (storage.has('options')) {
			const old = storage.get('options');

			if (old !== null) {
				window.SugarCube.settings = settings = Object.assign(settingsCreate(), old);
			}

			settingsSave();
			storage.delete('options');
		}
		/* /legacy */

		// Load existing settings.
		settingsLoad();

		// Execute `onInit` callbacks.
		_definitions.forEach(def => {
			if (def.hasOwnProperty('onInit')) {
				const thisArg = {
					name    : def.name,
					value   : settings[def.name],
					default : def.default
				};

				if (def.hasOwnProperty('list')) {
					thisArg.list = def.list;
				}

				def.onInit.call(thisArg);
			}
		});
	}

	function settingsCreate() {
		return Object.create(null);
	}

	function settingsSave() {
		const savedSettings = settingsCreate();

		if (Object.keys(settings).length > 0) {
			_definitions
				.filter(def => def.type !== Types.Header && settings[def.name] !== def.default)
				.forEach(def => savedSettings[def.name] = settings[def.name]);
		}

		if (Object.keys(savedSettings).length === 0) {
			storage.delete('settings');
			return true;
		}

		return storage.set('settings', savedSettings);
	}

	function settingsLoad() {
		const defaultSettings = settingsCreate();
		const loadedSettings  = storage.get('settings') || settingsCreate();

		// Load the defaults.
		_definitions
			.filter(def => def.type !== Types.Header)
			.forEach(def => defaultSettings[def.name] = def.default);

		// Assign to the `settings` object while overwriting the defaults with the loaded settings.
		window.SugarCube.settings = settings = Object.assign(defaultSettings, loadedSettings);
	}

	function settingsClear() {
		window.SugarCube.settings = settings = settingsCreate();
		storage.delete('settings');
		return true;
	}

	function settingsReset(name) {
		if (arguments.length === 0) {
			settingsClear();
			settingsLoad();
		}
		else {
			if (name == null || !definitionsHas(name)) { // lazy equality for null
				throw new Error(`nonexistent setting "${name}"`);
			}

			const def = definitionsGet(name);

			if (def.type !== Types.Header) {
				settings[name] = def.default;
			}
		}

		return settingsSave();
	}


	/*******************************************************************************************************************
		Definitions Functions.
	*******************************************************************************************************************/
	function definitionsForEach(callback, thisArg) {
		_definitions.forEach(callback, thisArg);
	}

	function definitionsAdd(type, name, def) {
		if (arguments.length < 3) {
			const errors = [];
			if (arguments.length < 1) { errors.push('type'); }
			if (arguments.length < 2) { errors.push('name'); }
			if (arguments.length < 3) { errors.push('definition'); }
			throw new Error(`missing parameters, no ${errors.join(' or ')} specified`);
		}

		if (typeof def !== 'object') {
			throw new TypeError('definition parameter must be an object');
		}

		if (definitionsHas(name)) {
			throw new Error(`cannot clobber existing setting "${name}"`);
		}

		/*
			Definition object properties and types:
				type      →  (all)   → Setting.Types
				name      →  (all)   → string
				label     →  (all)   → string
				desc      →  (all)   → string
				default
					(if defined)
 						  →  Toggle  → boolean
						  →  List    → Array
						  →  Range   → number
					(if undefined)
						  →  Toggle  → false
						  →  List    → list[0]
						  →  Range   → max
				list      →  List    → Array
				min       →  Range   → number
				max       →  Range   → number
				step      →  Range   → number
				onInit    →  (all)   → function
				onChange  →  (all)   → function
		*/
		const definition = {
			type,
			name,
			label : typeof def.label === 'string' ? def.label.trim() : ''
		};

		if (typeof def.desc === 'string') {
			const desc = def.desc.trim();

			if (desc !== '') {
				definition.desc = desc;
			}
		}

		switch (type) {
		case Types.Header:
			break;

		case Types.Toggle:
			definition.default = !!def.default;
			break;

		case Types.List:
			if (!def.hasOwnProperty('list')) {
				throw new Error('no list specified');
			}
			else if (!Array.isArray(def.list)) {
				throw new TypeError('list must be an array');
			}
			else if (def.list.length === 0) {
				throw new Error('list must not be empty');
			}

			definition.list = Object.freeze(def.list);

			if (def.default == null) { // lazy equality for null
				definition.default = def.list[0];
			}
			else {
				const defaultIndex = def.list.indexOf(def.default);

				if (defaultIndex === -1) {
					throw new Error('list does not contain default');
				}

				definition.default = def.list[defaultIndex];
			}
			break;

		case Types.Range:
			if (!def.hasOwnProperty('min')) {
				throw new Error('no min specified');
			}
			else if (
				   typeof def.min !== 'number'
				|| Number.isNaN(def.min)
				|| !Number.isFinite(def.min)
			) {
				throw new TypeError('min must be a finite number');
			}

			if (!def.hasOwnProperty('max')) {
				throw new Error('no max specified');
			}
			else if (
				   typeof def.max !== 'number'
				|| Number.isNaN(def.max)
				|| !Number.isFinite(def.max)
			) {
				throw new TypeError('max must be a finite number');
			}

			if (!def.hasOwnProperty('step')) {
				throw new Error('no step specified');
			}
			else if (
				   typeof def.step !== 'number'
				|| Number.isNaN(def.step)
				|| !Number.isFinite(def.step)
				|| def.step <= 0
			) {
				throw new TypeError('step must be a finite number greater than zero');
			}
			else {
				// Determine how many fractional digits we need to be concerned with based on the step value.
				const fracDigits = (() => {
					const str = String(def.step);
					const pos = str.lastIndexOf('.');
					return pos === -1 ? 0 : str.length - pos - 1;
				})();

				// Set up a function to validate a given value against the step value.
				function stepValidate(value) {
					if (fracDigits > 0) {
						const ma = Number(`${def.min}e${fracDigits}`);
						const sa = Number(`${def.step}e${fracDigits}`);
						const va = Number(`${value}e${fracDigits}`) - ma;
						return Number(`${va - va % sa + ma}e-${fracDigits}`);
					}

					const va = value - def.min;
					return va - va % def.step + def.min;
				}

				// Sanity check the max value against the step value.
				if (stepValidate(def.max) !== def.max) {
					throw new RangeError(`max (${def.max}) is not a multiple of the step (${def.step}) plus the min (${def.min})`);
				}
			}

			definition.max = def.max;
			definition.min = def.min;
			definition.step = def.step;

			if (def.default == null) { // lazy equality for null
				definition.default = def.max;
			}
			else {
				if (
					   typeof def.default !== 'number'
					|| Number.isNaN(def.default)
					|| !Number.isFinite(def.default)
				) {
					throw new TypeError('default must be a finite number');
				}
				else if (def.default < def.min) {
					throw new RangeError(`default (${def.default}) is less than min (${def.min})`);
				}
				else if (def.default > def.max) {
					throw new RangeError(`default (${def.default}) is greater than max (${def.max})`);
				}

				definition.default = def.default;
			}
			break;

		default:
			throw new Error(`unknown Setting type: ${type}`);
		}

		if (typeof def.onInit === 'function') {
			definition.onInit = Object.freeze(def.onInit);
		}

		if (typeof def.onChange === 'function') {
			definition.onChange = Object.freeze(def.onChange);
		}

		_definitions.push(Object.freeze(definition));
	}

	function definitionsAddHeader(name, desc) {
		definitionsAdd(Types.Header, name, { desc });
	}

	function definitionsAddToggle(...args) {
		definitionsAdd(Types.Toggle, ...args);
	}

	function definitionsAddList(...args) {
		definitionsAdd(Types.List, ...args);
	}

	function definitionsAddRange(...args) {
		definitionsAdd(Types.Range, ...args);
	}

	function definitionsIsEmpty() {
		return _definitions.length === 0;
	}

	function definitionsHas(name) {
		return _definitions.some(definition => definition.name === name);
	}

	function definitionsGet(name) {
		return _definitions.find(definition => definition.name === name);
	}

	function definitionsDelete(name) {
		if (definitionsHas(name)) {
			delete settings[name];
		}

		for (let i = 0; i < _definitions.length; ++i) {
			if (_definitions[i].name === name) {
				_definitions.splice(i, 1);
				definitionsDelete(name);
				break;
			}
		}
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Enumerations.
		*/
		Types : { value : Types },

		/*
			Settings Functions.
		*/
		init   : { value : settingsInit },
		create : { value : settingsCreate },
		save   : { value : settingsSave },
		load   : { value : settingsLoad },
		clear  : { value : settingsClear },
		reset  : { value : settingsReset },

		/*
			Definitions Functions.
		*/
		forEach   : { value : definitionsForEach },
		add       : { value : definitionsAdd },
		addHeader : { value : definitionsAddHeader },
		addToggle : { value : definitionsAddToggle },
		addList   : { value : definitionsAddList },
		addRange  : { value : definitionsAddRange },
		isEmpty   : { value : definitionsIsEmpty },
		has       : { value : definitionsHas },
		get       : { value : definitionsGet },
		delete    : { value : definitionsDelete }
	}));
})();

/***********************************************************************************************************************

	story.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Alert, Config, Passage, Scripting, StyleWrapper, Util, Wikifier */

var Story = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Map of normal passages.
	const _passages = {};

	// List of init passages.
	const _inits = [];

	// List of script passages.
	const _scripts = [];

	// List of style passages.
	const _styles = [];

	// List of widget passages.
	const _widgets = [];

	// Story title.
	let _title = '';

	// Story IFID.
	let _ifId = '';

	// DOM-compatible ID.
	let _domId = '';


	/*******************************************************************************************************************
		Story Functions.
	*******************************************************************************************************************/
	function storyLoad() {
		if (DEBUG) { console.log('[Story/storyLoad()]'); }

		const validationCodeTags = [
			'init',
			'widget'
		];
		const validationNoCodeTagPassages = [
			'PassageDone',
			'PassageFooter',
			'PassageHeader',
			'PassageReady',
			'StoryAuthor',
			'StoryBanner',
			'StoryCaption',
			'StoryInit',
			'StoryMenu',
			'StoryShare',
			'StorySubtitle'
		];

		function validateStartingPassage(passage) {
			if (passage.tags.includesAny(validationCodeTags)) {
				throw new Error(`starting passage "${passage.title}" contains special tags; invalid: "${passage.tags.filter(tag => validationCodeTags.includes(tag)).sort().join('", "')}"`);
			}
		}

		function validateSpecialPassages(passage, ...tags) {
			if (validationNoCodeTagPassages.includes(passage.title)) {
				throw new Error(`special passage "${passage.title}" contains special tags; invalid: "${tags.sort().join('", "')}"`);
			}

			const codeTags  = [...validationCodeTags];
			const foundTags = [];

			passage.tags.forEach(tag => {
				if (codeTags.includes(tag)) {
					foundTags.push(...codeTags.delete(tag));
				}
			});

			if (foundTags.length > 1) {
				throw new Error(`passage "${passage.title}" contains multiple special tags; invalid: "${foundTags.sort().join('", "')}"`);
			}
		}

		// For Twine 1.
		if (TWINE1) {
			/*
				Additional Twine 1 validation setup.
			*/
			validationCodeTags.unshift('script', 'stylesheet');
			validationNoCodeTagPassages.push('StoryTitle');

			/*
				Set the default starting passage.
			*/
			Config.passages.start = (() => {
				/*
					Handle the Twine 1.4+ Test Play From Here feature.

					WARNING: Do not remove the `String()` wrapper from or change the quote
					style of the `"START_AT"` replacement target.  The former is there to
					keep UglifyJS from pruning the code into oblivion—i.e. minifying the
					code into something broken.  The latter is there because the Twine 1
					pattern that matches it depends upon the double quotes.

				*/
				const testPlay = String("START_AT"); // eslint-disable-line quotes

				if (testPlay !== '') {
					if (DEBUG) { console.log(`\tTest play; starting passage: "${testPlay}"`); }

					Config.debug = true;
					return testPlay;
				}

				// In the absence of a `testPlay` value, return 'Start'.
				return 'Start';
			})();

			/*
				Process the passages, excluding any tagged 'Twine.private' or 'annotation'.
			*/
			jQuery('#store-area')
				.children(':not([tags~="Twine.private"],[tags~="annotation"])')
				.each(function () {
					const $this   = jQuery(this);
					const passage = new Passage($this.attr('tiddler'), this);

					// Special cases.
					if (passage.title === Config.passages.start) {
						validateStartingPassage(passage);
						_passages[passage.title] = passage;
					}
					else if (passage.tags.includes('init')) {
						validateSpecialPassages(passage, 'init');
						_inits.push(passage);
					}
					else if (passage.tags.includes('stylesheet')) {
						validateSpecialPassages(passage, 'stylesheet');
						_styles.push(passage);
					}
					else if (passage.tags.includes('script')) {
						validateSpecialPassages(passage, 'script');
						_scripts.push(passage);
					}
					else if (passage.tags.includes('widget')) {
						validateSpecialPassages(passage, 'widget');
						_widgets.push(passage);
					}

					// All other passages.
					else {
						_passages[passage.title] = passage;
					}
				});

			/*
				Set the story title or throw an exception.
			*/
			if (_passages.hasOwnProperty('StoryTitle')) {
				const buf = document.createDocumentFragment();
				new Wikifier(buf, _passages.StoryTitle.processText().trim());
				_storySetTitle(buf.textContent);
			}
			else {
				throw new Error('cannot find the "StoryTitle" special passage');
			}

			/*
				Set the default saves ID (must be done after the call to `_storySetTitle()`).
			*/
			Config.saves.id = Story.domId;
		}

		// For Twine 2.
		else {
			const $storydata = jQuery('tw-storydata');
			const startNode  = $storydata.attr('startnode') || '';

			/*
				Set the default starting passage.
			*/
			Config.passages.start = null; // no default in Twine 2

			/*
				Process story options.

				NOTE: Currently, the only option of interest is 'debug', so we
				simply use a regular expression to check for it.
			*/
			Config.debug = /\bdebug\b/.test($storydata.attr('options'));

			/*
				Process stylesheet passages.
			*/
			$storydata
				.children('style') // alternatively: '[type="text/twine-css"]' or '#twine-user-stylesheet'
				.each(function (i) {
					_styles.push(new Passage(`tw-user-style-${i}`, this));
				});

			/*
				Process script passages.
			*/
			$storydata
				.children('script') // alternatively: '[type="text/twine-javascript"]' or '#twine-user-script'
				.each(function (i) {
					_scripts.push(new Passage(`tw-user-script-${i}`, this));
				});

			/*
				Process normal passages, excluding any tagged 'Twine.private' or 'annotation'.
			*/
			$storydata
				.children('tw-passagedata:not([tags~="Twine.private"],[tags~="annotation"])')
				.each(function () {
					const $this   = jQuery(this);
					const pid     = $this.attr('pid') || '';
					const passage = new Passage($this.attr('name'), this);

					// Special cases.
					if (pid === startNode && startNode !== '') {
						Config.passages.start = passage.title;
						validateStartingPassage(passage);
						_passages[passage.title] = passage;
					}
					else if (passage.tags.includes('init')) {
						validateSpecialPassages(passage, 'init');
						_inits.push(passage);
					}
					else if (passage.tags.includes('widget')) {
						validateSpecialPassages(passage, 'widget');
						_widgets.push(passage);
					}

					// All other passages.
					else {
						_passages[passage.title] = passage;
					}
				});

			/*
				Get the story IFID.
			*/
			_ifId = $storydata.attr('ifid');

			/*
				Set the story title.

				FIXME: Maybe `$storydata.attr('name')` should be used instead of `'Course of Temptation'`?
			*/
			// _storySetTitle($storydata.attr('name'));
			_storySetTitle('Obscura');

			/*
				Set the default saves ID (must be done after the call to `_storySetTitle()`).
			*/
			Config.saves.id = Story.domId;
		}
	}

	function storyInit() {
		if (DEBUG) { console.log('[Story/storyInit()]'); }

		/*
			Add the story styles.
		*/
		(() => {
			const storyStyle = document.createElement('style');

			new StyleWrapper(storyStyle)
				.add(_styles.map(style => style.text.trim()).join('\n'));

			jQuery(storyStyle)
				.appendTo(document.head)
				.attr({
					id   : 'style-story',
					type : 'text/css'
				});
		})();

		/*
			Evaluate the story scripts.
		*/
		for (let i = 0; i < _scripts.length; ++i) {
			try {
				Scripting.evalJavaScript(_scripts[i].text);
			}
			catch (ex) {
				console.error(ex);
				Alert.error(_scripts[i].title, typeof ex === 'object' ? ex.message : ex);
			}
		}

		/*
			Process the story widgets.
		*/
		for (let i = 0; i < _widgets.length; ++i) {
			try {
				Wikifier.wikifyEval(_widgets[i].processText());
			}
			catch (ex) {
				console.error(ex);
				Alert.error(_widgets[i].title, typeof ex === 'object' ? ex.message : ex);
			}
		}
	}

	function _storySetTitle(rawTitle) {
		if (rawTitle == null) { // lazy equality for null
			throw new Error('story title must not be null or undefined');
		}

		const title = Util.unescape(String(rawTitle)).trim();

		if (title === '') { // lazy equality for null
			throw new Error('story title must not be empty or consist solely of whitespace');
		}

		document.title = _title = title;

		// TODO: In v3 the `_domId` should be created from a combination of the
		// `_title` slug and the IFID, if available, to avoid collisions between
		// stories whose titles generate identical slugs.
		_domId = Util.slugify(_title);

		// [v2] Protect the `_domId` against being an empty string.
		//
		// If `_domId` is empty, attempt a failover.
		if (_domId === '') {
			// If `_ifId` is not empty, then use it.
			if (_ifId !== '') {
				_domId = _ifId;
			}

			// Elsewise generate a string from the `_title`'s code points (in hexadecimal).
			else {
				for (let i = 0, len = _title.length; i < len; ++i) {
					const { char, start, end } = Util.charAndPosAt(_title, i);
					_domId += char.codePointAt(0).toString(16);
					i += end - start;
				}
			}
		}
	}

	function storyTitle() {
		return _title;
	}

	function storyDomId() {
		return _domId;
	}

	function storyIfId() {
		return _ifId;
	}


	/*******************************************************************************************************************
		Passage Functions.
	*******************************************************************************************************************/
	function passagesAdd(passage) {
		if (!(passage instanceof Passage)) {
			throw new TypeError('Story.add passage parameter must be an instance of Passage');
		}

		const title = passage.title;

		if (!_passages.hasOwnProperty(title)) {
			_passages[title] = passage;
			return true;
		}

		return false;
	}

	function passagesHas(title) {
		let type = typeof title;

		switch (type) {
		// Valid types.
		case 'number':
		case 'string':
			return _passages.hasOwnProperty(String(title));

		// Invalid types.  We do the extra processing just to make a nicer error.
		case 'undefined':
			/* no-op */
			break;

		case 'object':
			type = title === null ? 'null' : 'an object';
			break;

		default: // 'bigint', 'boolean', 'function', 'symbol'
			type = `a ${type}`;
			break;
		}

		throw new TypeError(`Story.has title parameter cannot be ${type}`);
	}

	function passagesGet(title) {
		let type = typeof title;

		switch (type) {
		// Valid types.
		case 'number':
		case 'string':
		/* eslint-disable indent */
			{
				const id = String(title);
				return _passages.hasOwnProperty(id) ? _passages[id] : new Passage(id || '(unknown)');
			}
		/* eslint-enable indent */

		// Invalid types.  We do the extra processing just to make a nicer error.
		case 'undefined':
			/* no-op */
			break;

		case 'object':
			type = title === null ? 'null' : 'an object';
			break;

		default: // 'bigint', 'boolean', 'function', 'symbol'
			type = `a ${type}`;
			break;
		}

		throw new TypeError(`Story.get title parameter cannot be ${type}`);
	}

	function passagesGetAllInit() {
		// NOTE: Return an immutable copy, rather than the internal mutable original.
		return Object.freeze(Array.from(_inits));
	}

	function passagesGetAllRegular() {
		// NOTE: Return an immutable copy, rather than the internal mutable original.
		return Object.freeze(Object.assign({}, _passages));
	}

	function passagesGetAllScript() {
		// NOTE: Return an immutable copy, rather than the internal mutable original.
		return Object.freeze(Array.from(_scripts));
	}

	function passagesGetAllStylesheet() {
		// NOTE: Return an immutable copy, rather than the internal mutable original.
		return Object.freeze(Array.from(_styles));
	}

	function passagesGetAllWidget() {
		// NOTE: Return an immutable copy, rather than the internal mutable original.
		return Object.freeze(Array.from(_widgets));
	}

	function passagesLookup(key, value  /* legacy */, sortKey = 'title'/* /legacy */) {
		const results = [];

		Object.keys(_passages).forEach(name => {
			const passage = _passages[name];

			// Objects (sans `null`).
			if (typeof passage[key] === 'object' && passage[key] !== null) {
				// The only object type currently supported is `Array`, since the
				// non-method `Passage` object properties currently yield only either
				// primitives or arrays.
				if (passage[key] instanceof Array && passage[key].some(m => Util.sameValueZero(m, value))) {
					results.push(passage);
				}
			}

			// All other types (incl. `null`).
			else if (Util.sameValueZero(passage[key], value)) {
				results.push(passage);
			}
		});

		// For v3.
		// /* eslint-disable no-nested-ternary */
		// // QUESTION: Do we really need to sort the list?
		// results.sort((a, b) => a.title === b.title ? 0 : a.title < b.title ? -1 : +1);
		// /* eslint-enable no-nested-ternary */

		/* legacy */
		/* eslint-disable eqeqeq, no-nested-ternary, max-len */
		results.sort((a, b) => a[sortKey] == b[sortKey] ? 0 : a[sortKey] < b[sortKey] ? -1 : +1); // lazy equality for null
		/* eslint-enable eqeqeq, no-nested-ternary, max-len */
		/* /legacy */

		return results;
	}

	function passagesLookupWith(predicate /* legacy */, sortKey = 'title'/* /legacy */) {
		if (typeof predicate !== 'function') {
			throw new TypeError('Story.lookupWith predicate parameter must be a function');
		}

		const results = [];

		Object.keys(_passages).forEach(name => {
			const passage = _passages[name];

			if (predicate(passage)) {
				results.push(passage);
			}
		});

		// For v3.
		// /* eslint-disable no-nested-ternary */
		// // QUESTION: Do we really need to sort the list?
		// results.sort((a, b) => a.title === b.title ? 0 : a.title < b.title ? -1 : +1);
		// /* eslint-enable no-nested-ternary */

		/* legacy */
		/* eslint-disable eqeqeq, no-nested-ternary, max-len */
		results.sort((a, b) => a[sortKey] == b[sortKey] ? 0 : a[sortKey] < b[sortKey] ? -1 : +1); // lazy equality for null
		/* eslint-enable eqeqeq, no-nested-ternary, max-len */
		/* /legacy */

		return results;
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		// Story Functions.
		load  : { value : storyLoad },
		init  : { value : storyInit },
		title : { get : storyTitle },
		domId : { get : storyDomId },
		ifId  : { get : storyIfId },

		// Passage Functions.
		add              : { value : passagesAdd },
		has              : { value : passagesHas },
		get              : { value : passagesGet },
		getAllInit       : { value : passagesGetAllInit },
		getAllRegular    : { value : passagesGetAllRegular },
		getAllScript     : { value : passagesGetAllScript },
		getAllStylesheet : { value : passagesGetAllStylesheet },
		getAllWidget     : { value : passagesGetAllWidget },
		lookup           : { value : passagesLookup },
		lookupWith       : { value : passagesLookupWith }
	}));
})();

/***********************************************************************************************************************

	ui.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/*
	global Alert, Browser, Config, Dialog, Engine, Has, L10n, Save, Setting, State, Story, Util, Wikifier, idb
	       errorPrologRegExp, settings
*/

var UI = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
		UI Functions, Core.
	*******************************************************************************************************************/
	function uiAssembleLinkList(passage, listEl) {
		let list = listEl;

		// Cache the values of `Config.debug` and `Config.cleanupWikifierOutput`,
		// then disable them during this method's run.
		const debugState = Config.debug;
		const cleanState = Config.cleanupWikifierOutput;
		Config.debug = false;
		Config.cleanupWikifierOutput = false;

		try {
			if (list == null) { // lazy equality for null
				list = document.createElement('ul');
			}

			// Wikify the content of the given source passage into a fragment.
			const frag = document.createDocumentFragment();
			new Wikifier(frag, Story.get(passage).processText().trim());

			// Gather the text of any error elements within the fragment…
			const errors = [...frag.querySelectorAll('.error')]
				.map(errEl => errEl.textContent.replace(errorPrologRegExp, ''));

			// …and throw an exception, if there were any errors.
			if (errors.length > 0) {
				throw new Error(errors.join('; '));
			}

			while (frag.hasChildNodes()) {
				const node = frag.firstChild;

				// Create list items for <a>-element nodes.
				if (node.nodeType === Node.ELEMENT_NODE && node.nodeName.toUpperCase() === 'A') {
					const li = document.createElement('li');
					list.appendChild(li);
					li.appendChild(node);
				}

				// Discard non-<a>-element nodes.
				else {
					frag.removeChild(node);
				}
			}
		}
		finally {
			// Restore the `Config` settings to their original values.
			Config.cleanupWikifierOutput = cleanState;
			Config.debug = debugState;
		}

		return list;
	}


	/*******************************************************************************************************************
		UI Functions, Built-ins.
	*******************************************************************************************************************/
	function uiOpenAlert(message, /* options, closeFn */ ...args) {
		jQuery(Dialog.setup(L10n.get('alertTitle'), 'alert'))
			.append(
				  `<p>${message}</p><ul class="buttons">`
				+ `<li><button id="alert-ok" class="ui-close">${L10n.get(['alertOk', 'ok'])}</button></li>`
				+ '</ul>'
			);
		Dialog.open(...args);
	}

	function uiOpenJumpto(/* options, closeFn */ ...args) {
		uiBuildJumpto();
		Dialog.open(...args);
	}

	function uiOpenRestart(/* options, closeFn */ ...args) {
		uiBuildRestart();
		Dialog.open(...args);
	}

	function uiOpenSaves(/* options, closeFn */ ...args) {
		// use idb when available
		if (idb.active) {
			Dialog.create('saves', 'saves').append($(document.createElement('h3')).addClass('saves-loading').text('Loading the save list, please wait...'));
			idb.saveList();
		}
		else uiBuildSaves();
		Dialog.open(...args);
	}

	function uiOpenSettings(/* options, closeFn */ ...args) {
		uiBuildSettings();
		Dialog.open(...args);
	}

	function uiOpenShare(/* options, closeFn */ ...args) {
		uiBuildShare();
		Dialog.open(...args);
	}

	function uiBuildAutoload() {
		if (DEBUG) { console.log('[UI/uiBuildAutoload()]'); }

		jQuery(Dialog.setup(L10n.get('autoloadTitle'), 'autoload'))
			.append(
				/* eslint-disable max-len */
				  `<p>${L10n.get('autoloadPrompt')}</p><ul class="buttons">`
				+ `<li><button id="autoload-ok" class="ui-close">${L10n.get(['autoloadOk', 'ok'])}</button></li>`
				+ `<li><button id="autoload-cancel" class="ui-close">${L10n.get(['autoloadCancel', 'cancel'])}</button></li>`
				+ '</ul>'
				/* eslint-enable max-len */
			);

		// Add an additional delegated click handler for the `.ui-close` elements to handle autoloading.
		jQuery(document).one('click.autoload', '.ui-close', ev => {
			const isAutoloadOk = ev.target.id === 'autoload-ok';
			jQuery(document).one(':dialogclosed', () => {
				if (DEBUG) { console.log(`\tattempting autoload: "${Save.autosave.get().title}"`); }

				if (!isAutoloadOk || !Save.autosave.load()) {
					Engine.play(Config.passages.start);
				}
			});
		});

		return true;
	}

	function uiBuildJumpto() {
		if (DEBUG) { console.log('[UI/uiBuildJumpto()]'); }

		const list = document.createElement('ul');

		jQuery(Dialog.setup(L10n.get('jumptoTitle'), 'jumpto list'))
			.append(list);

		const expired = State.expired.length;

		for (let i = State.size - 1; i >= 0; --i) {
			if (i === State.activeIndex) {
				continue;
			}

			const passage = Story.get(State.history[i].title);

			if (passage && passage.tags.includes('bookmark')) {
				jQuery(document.createElement('li'))
					.append(
						jQuery(document.createElement('a'))
							.ariaClick({ one : true }, (function (idx) {
								return () => jQuery(document).one(':dialogclosed', () => Engine.goTo(idx));
							})(i))
							.addClass('ui-close')
							.text(`${L10n.get('jumptoTurn')} ${expired + i + 1}: ${passage.description()}`)
					)
					.appendTo(list);
			}
		}

		if (!list.hasChildNodes()) {
			jQuery(list).append(`<li><a><em>${L10n.get('jumptoUnavailable')}</em></a></li>`);
		}
	}

	function uiBuildRestart() {
		if (DEBUG) { console.log('[UI/uiBuildRestart()]'); }

		jQuery(Dialog.setup(L10n.get('restartTitle'), 'restart'))
			.append(
				/* eslint-disable max-len */
				  `<p>${L10n.get('restartPrompt')}</p><ul class="buttons">`
				+ `<li><button id="restart-ok">${L10n.get(['restartOk', 'ok'])}</button></li>`
				+ `<li><button id="restart-cancel" class="ui-close">${L10n.get(['restartCancel', 'cancel'])}</button></li>`
				+ '</ul>'
				/* eslint-enable max-len */
			)
			.find('#restart-ok')
			/*
				Instead of adding '.ui-close' to '#restart-ok' (to receive the use of the default
				delegated dialog close handler), we set up a special case close handler here.  We
				do this to ensure that the invocation of `Engine.restart()` happens after the dialog
				has fully closed.  If we did not, then a race condition could occur, causing display
				shenanigans.
			*/
			.ariaClick({ one : true }, () => {
				jQuery(document).one(':dialogclosed', () => Engine.restart());
				Dialog.close();
			});

		return true;
	}

	function uiBuildSaves() {
		const savesAllowed = typeof Config.saves.isAllowed !== 'function' || Config.saves.isAllowed();

		function createActionItem(bId, bClass, bText, bAction) {
			const $btn = jQuery(document.createElement('button'))
				.attr('id', `saves-${bId}`)
				.html(bText);

			if (bClass) {
				$btn.addClass(bClass);
			}

			if (bAction) {
				$btn.ariaClick(bAction);
			}
			else {
				$btn.ariaDisabled(true);
			}

			return jQuery(document.createElement('li'))
				.append($btn);
		}

		function createSaveList() {
			function createButton(bId, bClass, bText, bSlot, bAction) {
				const $btn = jQuery(document.createElement('button'))
					.attr('id', `saves-${bId}-${bSlot}`)
					.addClass(bId)
					.html(bText);

				if (bClass) {
					$btn.addClass(bClass);
				}

				if (bAction) {
					if (bSlot === 'auto') {
						$btn.ariaClick({
							label : `${bText} ${L10n.get('savesLabelAuto')}`
						}, () => bAction());
					}
					else {
						$btn.ariaClick({
							label : `${bText} ${L10n.get('savesLabelSlot')} ${bSlot + 1}`
						}, () => bAction(bSlot));
					}
				}
				else {
					$btn.ariaDisabled(true);
				}

				return $btn;
			}

			const saves  = Save.get();
			const $tbody = jQuery(document.createElement('tbody'));

			if (Save.autosave.ok()) {
				const $tdSlot = jQuery(document.createElement('td'));
				const $tdLoad = jQuery(document.createElement('td'));
				const $tdDesc = jQuery(document.createElement('td'));
				const $tdDele = jQuery(document.createElement('td'));

				// Add the slot ID.
				jQuery(document.createElement('b'))
					.attr({
						title        : L10n.get('savesLabelAuto'),
						'aria-label' : L10n.get('savesLabelAuto')
					})
					.text('A') // '\u25C6' Black Diamond
					.appendTo($tdSlot);

				if (saves.autosave) {
					// Add the load button.
					$tdLoad.append(
						createButton('load', 'ui-close', L10n.get('savesLabelLoad'), 'auto', () => {
							jQuery(document).one(':dialogclosed', () => Save.autosave.load());
						})
					);

					// Add the description (title and datestamp).
					jQuery(document.createElement('div'))
						.text(saves.autosave.title)
						.appendTo($tdDesc);
					jQuery(document.createElement('div'))
						.addClass('datestamp')
						.html(
							saves.autosave.date
								? `${new Date(saves.autosave.date).toLocaleString()}`
								: `<em>${L10n.get('savesUnknownDate')}</em>`
						)
						.appendTo($tdDesc);

					// Add the delete button.
					$tdDele.append(
						createButton('delete', null, L10n.get('savesLabelDelete'), 'auto', () => {
							Save.autosave.delete();
							uiBuildSaves();
						})
					);
				}
				else {
					// Add the disabled load button.
					$tdLoad.append(
						createButton('load', null, L10n.get('savesLabelLoad'), 'auto')
					);

					// Add the description.
					$tdDesc.addClass('empty').text('\u2022\u00a0\u00a0\u2022\u00a0\u00a0\u2022');

					// Add the disabled delete button.
					$tdDele.append(
						createButton('delete', null, L10n.get('savesLabelDelete'), 'auto')
					);
				}

				jQuery(document.createElement('tr'))
					.append($tdSlot)
					.append($tdLoad)
					.append($tdDesc)
					.append($tdDele)
					.appendTo($tbody);
			}

			for (let i = 0, iend = saves.slots.length; i < iend; ++i) {
				const $tdSlot = jQuery(document.createElement('td'));
				const $tdLoad = jQuery(document.createElement('td'));
				const $tdDesc = jQuery(document.createElement('td'));
				const $tdDele = jQuery(document.createElement('td'));

				// Add the slot ID.
				$tdSlot.append(document.createTextNode(i + 1));

				if (saves.slots[i]) {
					// Add the save and load buttons.
					$tdLoad.append(
						createButton('save', 'ui-close', L10n.get('savesLabelSave'), i, Save.slots.save),
						createButton('load', 'ui-close', L10n.get('savesLabelLoad'), i, slot => {
							jQuery(document).one(':dialogclosed', () => Save.slots.load(slot));
						})
					);

					// Add the description (title and datestamp).
					jQuery(document.createElement('div'))
						.text(saves.slots[i].title)
						.appendTo($tdDesc);
					jQuery(document.createElement('div'))
						.addClass('datestamp')
						.html(
							saves.slots[i].date
								? `${new Date(saves.slots[i].date).toLocaleString()}`
								: `<em>${L10n.get('savesUnknownDate')}</em>`
						)
						.appendTo($tdDesc);

					// Add the delete button.
					$tdDele.append(
						createButton('delete', null, L10n.get('savesLabelDelete'), i, slot => {
							Save.slots.delete(slot);
							uiBuildSaves();
						})
					);
				}
				else {
					// Add the save button.
					$tdLoad.append(
						createButton('save', 'ui-close', L10n.get('savesLabelSave'), i, savesAllowed ? Save.slots.save : null)
					);

					// Add the description.
					$tdDesc.addClass('empty').text('\u2022\u00a0\u00a0\u2022\u00a0\u00a0\u2022');

					// Add the disabled delete button.
					$tdDele.append(
						createButton('delete', null, L10n.get('savesLabelDelete'), i)
					);
				}

				jQuery(document.createElement('tr'))
					.append($tdSlot)
					.append($tdLoad)
					.append($tdDesc)
					.append($tdDele)
					.appendTo($tbody);
			}

			return jQuery(document.createElement('table'))
				.attr('id', 'saves-list')
				.append($tbody);
		}

		if (DEBUG) { console.log('[UI/uiBuildSaves()]'); }

		const $dialogBody = jQuery(Dialog.setup(L10n.get('savesTitle'), 'saves'));
		const savesOk     = Save.ok();
		const fileOk      = Has.fileAPI && (Config.saves.tryDiskOnMobile || !Browser.isMobile.any());

		// Add saves list.
		if (savesOk) {
			$dialogBody.append(createSaveList());
		}

		// Add button bar items (export, import, and clear).
		if (savesOk || fileOk) {
			const $btnBar = jQuery(document.createElement('ul'))
				.addClass('buttons')
				.appendTo($dialogBody);

			if (fileOk) {
				$btnBar.append(createActionItem(
					'export',
					'ui-close',
					L10n.get('savesLabelExport'),
					savesAllowed ? () => Save.export() : null
				));
				if (navigator.clipboard) {
					$btnBar.append(createActionItem(
						'toClipboard',
						'ui-close',
						L10n.get('savesLabelToClipboard'),
						savesAllowed ? () => navigator.clipboard.writeText(Save.serialize()) : null
					));
				}
				$btnBar.append(createActionItem(
					'import',
					null,
					L10n.get('savesLabelImport'),
					() => $dialogBody.find('#saves-import-file').trigger('click')
				));

				// Add the hidden `input[type=file]` element which will be triggered by the `#saves-import` button.
				jQuery(document.createElement('input'))
					.css({
						display    : 'block',
						visibility : 'hidden',
						position   : 'fixed',
						left       : '-9999px',
						top        : '-9999px',
						width      : '1px',
						height     : '1px'
					})
					.attr({
						type          : 'file',
						id            : 'saves-import-file',
						tabindex      : -1,
						'aria-hidden' : true
					})
					.on('change', ev => {
						jQuery(document).one(':dialogclosed', () => Save.import(ev));
						Dialog.close();
					})
					.appendTo($dialogBody);
			}

			if (savesOk) {
				$btnBar.append(createActionItem(
					'clear',
					null,
					L10n.get('savesLabelClear'),
					Save.autosave.has() || !Save.slots.isEmpty()
						? () => {
							Save.clear();
							uiBuildSaves();
						}
						: null
				));
			}

			const $idbBar = jQuery(document.createElement('ul'))
				.addClass('buttons')
				.appendTo($dialogBody);

			$idbBar.append(createActionItem(
				'idbToggleSaves',
				null,
				'Enable indexedDB',
				!idb.lock
					? () => {
						Dialog.create('saves', 'saves').append($(document.createElement('h3')).addClass('saves-loading').text('Loading the save list, please wait...'));
						idb.updateSettings('active', true);
						idb.saveList();
					}
					: null
			));

			return true;
		}

		uiOpenAlert(L10n.get('savesIncapable'));
		return false;
	}

	function uiBuildSettings() {
		if (DEBUG) { console.log('[UI/uiBuildSettings()]'); }

		const $dialogBody = jQuery(Dialog.setup(L10n.get('settingsTitle'), 'settings'));

		Setting.forEach(control => {
			if (control.type === Setting.Types.Header) {
				const name     = control.name;
				const id       = Util.slugify(name);
				const $header  = jQuery(document.createElement('div'));
				const $heading = jQuery(document.createElement('h2'));

				$header
					.attr('id', `header-body-${id}`)
					.append($heading)
					.appendTo($dialogBody);
				$heading
					.attr('id', `header-heading-${id}`)
					.wiki(name);

				// Set up the description, if any.
				if (control.desc) {
					jQuery(document.createElement('p'))
						.attr('id', `header-desc-${id}`)
						.wiki(control.desc)
						.appendTo($header);
				}

				return;
			}

			const name        = control.name;
			const id          = Util.slugify(name);
			const $setting    = jQuery(document.createElement('div'));
			const $label      = jQuery(document.createElement('label'));
			const $controlBox = jQuery(document.createElement('div'));
			let $control;

			// Set up the label+control wrapper.
			jQuery(document.createElement('div'))
				.append($label)
				.append($controlBox)
				.appendTo($setting);

			// Set up the description, if any.
			if (control.desc) {
				jQuery(document.createElement('p'))
					.attr('id', `setting-desc-${id}`)
					.wiki(control.desc)
					.appendTo($setting);
			}

			// Set up the label.
			$label
				.attr({
					id  : `setting-label-${id}`,
					for : `setting-control-${id}` // must be in sync with $control's ID (see below)
				})
				.wiki(control.label);

			// Set up the control.
			if (settings[name] == null) { // lazy equality for null
				settings[name] = control.default;
			}

			switch (control.type) {
			case Setting.Types.Toggle:
				$control = jQuery(document.createElement('button'));

				if (settings[name]) {
					$control
						.addClass('enabled')
						.text(L10n.get('settingsOn'));
				}
				else {
					$control
						.text(L10n.get('settingsOff'));
				}

				$control.ariaClick(function () {
					if (settings[name]) {
						jQuery(this)
							.removeClass('enabled')
							.text(L10n.get('settingsOff'));
						settings[name] = false;
					}
					else {
						jQuery(this)
							.addClass('enabled')
							.text(L10n.get('settingsOn'));
						settings[name] = true;
					}

					Setting.save();

					if (control.hasOwnProperty('onChange')) {
						control.onChange.call({
							name,
							value   : settings[name],
							default : control.default
						});
					}
				});
				break;

			case Setting.Types.List:
				$control = jQuery(document.createElement('select'));

				for (let i = 0, iend = control.list.length; i < iend; ++i) {
					jQuery(document.createElement('option'))
						.val(i)
						.text(control.list[i])
						.appendTo($control);
				}

				$control
					.val(control.list.indexOf(settings[name]))
					.attr('tabindex', 0)
					.on('change', function () {
						settings[name] = control.list[Number(this.value)];
						Setting.save();

						if (control.hasOwnProperty('onChange')) {
							control.onChange.call({
								name,
								value   : settings[name],
								default : control.default,
								list    : control.list
							});
						}
					});
				break;

			case Setting.Types.Range:
				$control = jQuery(document.createElement('input'));

				// NOTE: Setting the value with `<jQuery>.val()` can cause odd behavior
				// in Edge if it's called before the type is set, so we use the `value`
				// content attribute here to dodge the entire issue.
				$control
					.attr({
						type     : 'range',
						min      : control.min,
						max      : control.max,
						step     : control.step,
						value    : settings[name],
						tabindex : 0
					})
					.on('change input', function () {
						settings[name] = Number(this.value);
						Setting.save();

						if (control.hasOwnProperty('onChange')) {
							control.onChange.call({
								name,
								value   : settings[name],
								default : control.default,
								min     : control.min,
								max     : control.max,
								step    : control.step
							});
						}
					})
					.on('keypress', ev => {
						if (ev.which === 13) {
							ev.preventDefault();
							$control.trigger('change');
						}
					});
				break;
			}

			$control
				.attr('id', `setting-control-${id}`)
				.appendTo($controlBox);

			$setting
				.attr('id', `setting-body-${id}`)
				.appendTo($dialogBody);
		});

		// Add the button bar.
		$dialogBody
			.append(
				  '<ul class="buttons">'
				+     `<li><button id="settings-ok" class="ui-close">${L10n.get(['settingsOk', 'ok'])}</button></li>`
				+     `<li><button id="settings-reset">${L10n.get('settingsReset')}</button></li>`
				+ '</ul>'
			)
			.find('#settings-reset')
			/*
				Instead of adding '.ui-close' to '#settings-reset' (to receive the use of the default
				delegated dialog close handler), we set up a special case close handler here.  We
				do this to ensure that the invocation of `window.location.reload()` happens after the
				dialog has fully closed.  If we did not, then a race condition could occur, causing
				display shenanigans.
			*/
			.ariaClick({ one : true }, () => {
				jQuery(document).one(':dialogclosed', () => {
					Setting.reset();
					window.location.reload();
				});
				Dialog.close();
			});

		return true;
	}

	function uiBuildShare() {
		if (DEBUG) { console.log('[UI/uiBuildShare()]'); }

		try {
			jQuery(Dialog.setup(L10n.get('shareTitle'), 'share list'))
				.append(uiAssembleLinkList('StoryShare'));
		}
		catch (ex) {
			console.error(ex);
			Alert.error('StoryShare', ex.message);
			return false;
		}

		return true;
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			UI Functions, Core.
		*/
		assembleLinkList : { value : uiAssembleLinkList },

		/*
			UI Functions, Built-ins.
		*/
		alert         : { value : uiOpenAlert },
		jumpto        : { value : uiOpenJumpto },
		restart       : { value : uiOpenRestart },
		saves         : { value : uiOpenSaves },
		settings      : { value : uiOpenSettings },
		share         : { value : uiOpenShare },
		buildAutoload : { value : uiBuildAutoload },
		buildJumpto   : { value : uiBuildJumpto },
		buildRestart  : { value : uiBuildRestart },
		buildSaves    : { value : uiBuildSaves },
		buildSettings : { value : uiBuildSettings },
		buildShare    : { value : uiBuildShare },

		/*
			Legacy Aliases.
		*/
		// `UIBar` methods.
		/* global UIBar */
		stow                     : { value : () => UIBar.stow() },
		unstow                   : { value : () => UIBar.unstow() },
		setStoryElements         : { value : () => UIBar.update() },
		// `Dialog` methods.
		isOpen                   : { value : (...args) => Dialog.isOpen(...args) },
		body                     : { value : () => Dialog.body() },
		setup                    : { value : (...args) => Dialog.setup(...args) },
		addClickHandler          : { value : (...args) => Dialog.addClickHandler(...args) },
		open                     : { value : (...args) => Dialog.open(...args) },
		close                    : { value : (...args) => Dialog.close(...args) },
		resize                   : { value : () => Dialog.resize() },
		// Deprecated method names.
		buildDialogAutoload      : { value : uiBuildAutoload },
		buildDialogJumpto        : { value : uiBuildJumpto },
		buildDialogRestart       : { value : uiBuildRestart },
		buildDialogSaves         : { value : uiBuildSaves },
		buildDialogSettings      : { value : uiBuildSettings },
		buildDialogShare         : { value : uiBuildShare },
		buildLinkListFromPassage : { value : uiAssembleLinkList }
	}));
})();

/***********************************************************************************************************************

	uibar.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/*
	global Alert, Dialog, Engine, L10n, Setting, State, Story, UI, Config, setDisplayTitle, setPageElement
*/

var UIBar = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// UI bar element cache.
	let _$uiBar = null;


	/*******************************************************************************
		UI Bar Functions.
	*******************************************************************************/

	function uiBarDestroy() {
		if (DEBUG) { console.log('[UIBar/uiBarDestroy()]'); }

		if (!_$uiBar) {
			return;
		}

		// Hide the UI bar.
		_$uiBar.hide();

		// Remove its namespaced events.
		jQuery(document).off('.ui-bar');

		// Remove its styles.
		jQuery(document.head).find('#style-ui-bar').remove();

		// Remove it from the DOM.
		_$uiBar.remove();

		// Drop the reference to the element.
		_$uiBar = null;
	}

	function uiBarHide() {
		if (_$uiBar) {
			_$uiBar.hide();
		}

		return this;
	}

	function uiBarInit() {
		if (DEBUG) { console.log('[UIBar/uiBarInit()]'); }

		if (document.getElementById('ui-bar')) {
			return;
		}

		// Generate the UI bar elements.
		const $elems = (() => {
			const toggleLabel   = L10n.get('uiBarToggle');
			const backwardLabel = L10n.get('uiBarBackward');
			const jumptoLabel   = L10n.get('uiBarJumpto');
			const forwardLabel  = L10n.get('uiBarForward');

			return jQuery(document.createDocumentFragment())
				.append(
					/* eslint-disable max-len */
					  '<div id="ui-bar" aria-live="polite">'
					+     '<div id="ui-bar-tray">'
					+         `<button id="ui-bar-toggle" tabindex="0" title="${toggleLabel}" aria-label="${toggleLabel}"></button>`
					+         '<div id="ui-bar-history">'
					+             `<button id="history-backward" tabindex="0" title="${backwardLabel}" aria-label="${backwardLabel}">\uE821</button>`
					+             `<button id="history-jumpto" tabindex="0" title="${jumptoLabel}" aria-label="${jumptoLabel}">\uE839</button>`
					+             `<button id="history-forward" tabindex="0" title="${forwardLabel}" aria-label="${forwardLabel}">\uE822</button>`
					+         '</div>'
					+     '</div>'
					+     '<div id="ui-bar-body">'
					+         '<header id="title" role="banner">'
					+             '<div id="story-banner"></div>'
					+             '<h1 id="story-title"></h1>'
					+             '<div id="story-subtitle"></div>'
					+             '<div id="story-title-separator"></div>'
					+             '<p id="story-author"></p>'
					+         '</header>'
					+         '<div id="story-caption"></div>'
					+         '<nav id="menu" role="navigation">'
					+             '<ul id="menu-story"></ul>'
					+             '<ul id="menu-core">'
					+                 `<li id="menu-item-saves"><a tabindex="0">${L10n.get('savesTitle')}</a></li>`
					+                 `<li id="menu-item-settings"><a tabindex="0">${L10n.get('settingsTitle')}</a></li>`
					+                 `<li id="menu-item-restart"><a tabindex="0">${L10n.get('restartTitle')}</a></li>`
					+                 `<li id="menu-item-share"><a tabindex="0">${L10n.get('shareTitle')}</a></li>`
					+             '</ul>'
					+         '</nav>'
					+     '</div>'
					+ '</div>'
					/* eslint-enable max-len */
				);
		})();

		/*
			Cache the UI bar element, since its going to be used often.

			NOTE: We rewrap the element itself, rather than simply using the result
			of `find()`, so that we cache an uncluttered jQuery-wrapper (i.e. `context`
			refers to the element and there is no `prevObject`).
		*/
		_$uiBar = jQuery($elems.find('#ui-bar').get(0));

		// Insert the UI bar elements into the page before the main script.
		$elems.insertBefore('body>script#script-sugarcube');

		// Set up the UI bar's global event handlers.
		jQuery(document)
			// Set up a handler for the history-backward/-forward buttons.
			.on(':historyupdate.ui-bar', (($backward, $forward) => () => {
				$backward.ariaDisabled(State.length < 2);
				$forward.ariaDisabled(State.length === State.size);
			})(jQuery('#history-backward'), jQuery('#history-forward')));
	}

	function uiBarIsHidden() {
		return _$uiBar && _$uiBar.css('display') === 'none';
	}

	function uiBarIsStowed() {
		return _$uiBar && _$uiBar.hasClass('stowed');
	}

	function uiBarShow() {
		if (_$uiBar) {
			_$uiBar.show();
		}

		return this;
	}

	function uiBarStart() {
		if (DEBUG) { console.log('[UIBar/uiBarStart()]'); }

		if (!_$uiBar) {
			return;
		}

		// Set up the #ui-bar's initial state.
		if (
			typeof Config.ui.stowBarInitially === 'boolean'
				? Config.ui.stowBarInitially
				: jQuery(window).width() <= Config.ui.stowBarInitially
		) {
			uiBarStow(true);
		}

		// Set up the #ui-bar-toggle and #ui-bar-history widgets.
		jQuery('#ui-bar-toggle')
			.ariaClick({
				label : L10n.get('uiBarToggle')
			}, () => _$uiBar.toggleClass('stowed'));

		jQuery('#history-backward')
			.ariaDisabled(State.length < 2)
			.ariaClick({
				label : L10n.get('uiBarBackward')
			}, () => Engine.backward());

		if (Story.lookup('tags', 'bookmark').length > 0) {
			jQuery('#history-jumpto')
				.ariaClick({
					label : L10n.get('uiBarJumpto')
				}, () => UI.jumpto());
		}
		else {
			jQuery('#history-jumpto').remove();
		}

		jQuery('#history-forward')
			.ariaDisabled(State.length === State.size)
			.ariaClick({
				label : L10n.get('uiBarForward')
			}, () => Engine.forward());

		if (!Config.history.controls) jQuery('#ui-bar-history').hide();

		// Set up the story display title.
		if (Story.has('StoryDisplayTitle')) {
			setDisplayTitle(Story.get('StoryDisplayTitle').processText());
		}
		else {
			if (TWINE1) { // for Twine 1
				setPageElement('story-title', 'StoryTitle', Story.title);
			}
			else { // for Twine 2
				jQuery('#story-title').text(Story.title);
			}
		}

		// Set up the dynamic page elements.
		if (!Story.has('StoryCaption')) {
			jQuery('#story-caption').remove();
		}

		if (!Story.has('StoryMenu')) {
			jQuery('#menu-story').remove();
		}

		if (!Config.ui.updateStoryElements) {
			// We only need to set the story elements here if `Config.ui.updateStoryElements`
			// is falsy, since otherwise they will be set by `Engine.play()`.
			uiBarUpdate();
		}

		// Set up the Saves menu item.
		jQuery('#menu-item-saves a')
			.ariaClick({
				role : 'button'
			}, ev => {
				ev.preventDefault();
				// use idb when available
				if (idb.active) {
					Dialog.create('saves', 'saves').append($(document.createElement('h3')).addClass('saves-loading').text('Loading the save list, please wait...'));
					idb.saveList();
				}
				// but keep the old system just in case
				else UI.buildSaves();
				Dialog.open();
			})
			.text(L10n.get('savesTitle'));

		// Set up the Settings menu item.
		if (!Setting.isEmpty()) {
			jQuery('#menu-item-settings a')
				.ariaClick({
					role : 'button'
				}, ev => {
					ev.preventDefault();
					UI.buildSettings();
					Dialog.open();
				})
				.text(L10n.get('settingsTitle'));
		}
		else {
			jQuery('#menu-item-settings').remove();
		}

		// Set up the Restart menu item.
		jQuery('#menu-item-restart a')
			.ariaClick({
				role : 'button'
			}, ev => {
				ev.preventDefault();
				UI.buildRestart();
				Dialog.open();
			})
			.text(L10n.get('restartTitle'));

		// Set up the Share menu item.
		if (Story.has('StoryShare')) {
			jQuery('#menu-item-share a')
				.ariaClick({
					role : 'button'
				}, ev => {
					ev.preventDefault();
					UI.buildShare();
					Dialog.open();
				})
				.text(L10n.get('shareTitle'));
		}
		else {
			jQuery('#menu-item-share').remove();
		}
	}

	function uiBarStow(noAnimation) {
		if (_$uiBar && !_$uiBar.hasClass('stowed')) {
			let $story;

			if (noAnimation) {
				$story = jQuery('#story');
				$story.addClass('no-transition');
				_$uiBar.addClass('no-transition');
			}

			_$uiBar.addClass('stowed');

			if (noAnimation) {
				setTimeout(() => {
					$story.removeClass('no-transition');
					_$uiBar.removeClass('no-transition');
				}, Engine.minDomActionDelay);
			}
		}

		return this;
	}

	function uiBarUnstow(noAnimation) {
		if (_$uiBar && _$uiBar.hasClass('stowed')) {
			let $story;

			if (noAnimation) {
				$story = jQuery('#story');
				$story.addClass('no-transition');
				_$uiBar.addClass('no-transition');
			}

			_$uiBar.removeClass('stowed');

			if (noAnimation) {
				setTimeout(() => {
					$story.removeClass('no-transition');
					_$uiBar.removeClass('no-transition');
				}, Engine.minDomActionDelay);
			}
		}

		return this;
	}

	function uiBarUpdate() {
		if (DEBUG) { console.log('[UIBar/uiBarUpdate()]'); }

		// Set up the display title, both the document title and page element.
		if (Story.has('StoryDisplayTitle')) {
			setDisplayTitle(Story.get('StoryDisplayTitle').processText());
		}

		if (!_$uiBar) {
			return;
		}

		// Set up the (non-navigation) dynamic page elements.
		setPageElement('story-banner', 'StoryBanner');
		setPageElement('story-subtitle', 'StorySubtitle');
		setPageElement('story-author', 'StoryAuthor');
		setPageElement('story-caption', 'StoryCaption');

		// Set up the #menu-story items.
		const menuStory = document.getElementById('menu-story');

		if (menuStory !== null) {
			jQuery(menuStory).empty();

			if (Story.has('StoryMenu')) {
				try {
					UI.assembleLinkList('StoryMenu', menuStory);
				}
				catch (ex) {
					console.error(ex);
					Alert.error('StoryMenu', ex.message);
				}
			}
		}
	}


	/*******************************************************************************
		Object Exports.
	*******************************************************************************/

	return Object.freeze(Object.defineProperties({}, {
		destroy  : { value : uiBarDestroy },
		hide     : { value : uiBarHide },
		init     : { value : uiBarInit },
		isHidden : { value : uiBarIsHidden },
		isStowed : { value : uiBarIsStowed },
		show     : { value : uiBarShow },
		start    : { value : uiBarStart },
		stow     : { value : uiBarStow },
		unstow   : { value : uiBarUnstow },
		update   : { value : uiBarUpdate },

		// Legacy Functions.
		setStoryElements : { value : uiBarUpdate }
	}));
})();

/***********************************************************************************************************************

	debugbar.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/*
	global DebugView, Engine, L10n, Patterns, State, Util, session
*/

var DebugBar = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	const _variableRe   = new RegExp(`^${Patterns.variable}$`);
	const _numericKeyRe = /^\d+$/;
	const _watchList    = [];
	let _$debugBar   = null;
	let _$watchBody  = null;
	let _$watchList  = null;
	let _$turnSelect = null;
	let _stowed      = true;


	/*******************************************************************************************************************
		Debug Bar Functions.
	*******************************************************************************************************************/
	function debugBarInit() {
		if (DEBUG) { console.log('[DebugBar/debugBarInit()]'); }

		/*
			Generate the debug bar elements and append them to the `<body>`.
		*/
		const barToggleLabel   = L10n.get('debugBarToggle');
		const watchAddLabel    = L10n.get('debugBarAddWatch');
		const watchAllLabel    = L10n.get('debugBarWatchAll');
		const watchNoneLabel   = L10n.get('debugBarWatchNone');
		const watchToggleLabel = L10n.get('debugBarWatchToggle');
		const viewsToggleLabel = L10n.get('debugBarViewsToggle');

		jQuery(document.createDocumentFragment())
			.append(
				/* eslint-disable max-len */
				  '<div id="debug-bar">'
				+     '<div id="debug-bar-watch">'
				+         `<div>${L10n.get('debugBarNoWatches')}</div>>`
				+     '</div>'
				+     '<div>'
				+         `<button id="debug-bar-watch-toggle" tabindex="0" title="${watchToggleLabel}" aria-label="${watchToggleLabel}">${L10n.get('debugBarLabelWatch')}</button>`
				+         `<label id="debug-bar-watch-label" for="debug-bar-watch-input">${L10n.get('debugBarLabelAdd')}</label>`
				+         '<input id="debug-bar-watch-input" name="debug-bar-watch-input" type="text" list="debug-bar-watch-list" tabindex="0">'
				+         '<datalist id="debug-bar-watch-list" aria-hidden="true" hidden="hidden"></datalist>'
				+         `<button id="debug-bar-watch-add" tabindex="0" title="${watchAddLabel}" aria-label="${watchAddLabel}"></button>`
				+         `<button id="debug-bar-watch-all" tabindex="0" title="${watchAllLabel}" aria-label="${watchAllLabel}"></button>`
				+         `<button id="debug-bar-watch-none" tabindex="0" title="${watchNoneLabel}" aria-label="${watchNoneLabel}"></button>`
				+     '</div>'
				+     '<div>'
				+         `<button id="debug-bar-views-toggle" tabindex="0" title="${viewsToggleLabel}" aria-label="${viewsToggleLabel}">${L10n.get('debugBarLabelViews')}</button>`
				+         `<label id="debug-bar-turn-label" for="debug-bar-turn-select">${L10n.get('debugBarLabelTurn')}</label>`
				+         '<select id="debug-bar-turn-select" tabindex="0"></select>'
				+     '</div>'
				+     `<button id="debug-bar-toggle" tabindex="0" title="${barToggleLabel}" aria-label="${barToggleLabel}"></button>`
				+ '</div>'
				+ '<div id="debug-bar-hint"></div>'
				/* eslint-enable max-len */
			)
			.appendTo('body');

		/*
			Cache various oft used elements.

			NOTE: We rewrap the elements themselves, rather than simply using
			the results of `find()`, so that we cache uncluttered jQuery-wrappers
			(i.e. `context` refers to the elements and there is no `prevObject`).
		*/
		_$debugBar   = jQuery('#debug-bar');
		_$watchBody  = jQuery(_$debugBar.find('#debug-bar-watch').get(0));
		_$watchList  = jQuery(_$debugBar.find('#debug-bar-watch-list').get(0));
		_$turnSelect = jQuery(_$debugBar.find('#debug-bar-turn-select').get(0));

		const $barToggle   = jQuery(_$debugBar.find('#debug-bar-toggle').get(0));
		const $watchToggle = jQuery(_$debugBar.find('#debug-bar-watch-toggle').get(0));
		const $watchInput  = jQuery(_$debugBar.find('#debug-bar-watch-input').get(0));
		const $watchAdd    = jQuery(_$debugBar.find('#debug-bar-watch-add').get(0));
		const $watchAll    = jQuery(_$debugBar.find('#debug-bar-watch-all').get(0));
		const $watchNone   = jQuery(_$debugBar.find('#debug-bar-watch-none').get(0));
		const $viewsToggle = jQuery(_$debugBar.find('#debug-bar-views-toggle').get(0));

		/*
			Set up the debug bar's local event handlers.
		*/
		$barToggle
			.ariaClick(debugBarToggle);
		$watchToggle
			.ariaClick(debugBarWatchToggle);
		$watchInput
			.on(':addwatch', function () {
				debugBarWatchAdd(this.value.trim());
				this.value = '';
			})
			.on('keypress', ev => {
				if (ev.which === 13) { // 13 is Return/Enter
					ev.preventDefault();
					$watchInput.trigger(':addwatch');
				}
			});
		$watchAdd
			.ariaClick(() => $watchInput.trigger(':addwatch'));
		$watchAll
			.ariaClick(debugBarWatchAddAll);
		$watchNone
			.ariaClick(debugBarWatchClear);
		_$turnSelect
			.on('change', function () {
				Engine.goTo(Number(this.value));
			});
		$viewsToggle
			.ariaClick(() => {
				DebugView.toggle();
				_updateSession();
			});

		/*
			Set up the debug bar's global event handlers.
		*/
		jQuery(document)
			// Set up a handler for the history select.
			.on(':historyupdate.debug-bar', _updateTurnSelect)
			// Set up a handler for the variables watch.
			.on(':passageend.debug-bar', () => {
				_updateWatchBody();
				_updateWatchList();
			})
			// Set up a handler for engine resets to clear the active debug session.
			.on(':enginerestart.debug-bar', _clearSession);

		/*
			Initially enable debug views if there's no active debug session.
		*/
		if (!_hasSession()) {
			DebugView.enable();
		}
	}

	function debugBarStart() {
		if (DEBUG) { console.log('[DebugBar/debugBarStart()]'); }

		// Attempt to restore an existing session.
		_restoreSession();

		// Update the UI.
		_updateBar();
		_updateTurnSelect();
		_updateWatchBody();
		_updateWatchList();
	}

	function debugBarIsStowed() {
		return _stowed;
	}

	function debugBarStow() {
		_debugBarStowNoUpdate();
		_stowed = true;
		_updateSession();
	}

	function debugBarUnstow() {
		_debugBarUnstowNoUpdate();
		_stowed = false;
		_updateSession();
	}

	function debugBarToggle() {
		if (_stowed) {
			debugBarUnstow();
		}
		else {
			debugBarStow();
		}
	}

	function debugBarWatchAdd(varName) {
		if (!_variableRe.test(varName)) {
			return;
		}

		_watchList.pushUnique(varName);
		_watchList.sort();
		_updateWatchBody();
		_updateWatchList();
		_updateSession();
	}

	function debugBarWatchAddAll() {
		Object.keys(State.variables).map(name => _watchList.pushUnique(`$${name}`));
		Object.keys(State.temporary).map(name => _watchList.pushUnique(`_${name}`));

		_watchList.sort();
		_updateWatchBody();
		_updateWatchList();
		_updateSession();
	}

	function debugBarWatchClear() {
		for (let i = _watchList.length - 1; i >= 0; --i) {
			_watchList.pop();
		}

		_updateWatchBody();
		_updateWatchList();
		_updateSession();
	}

	function debugBarWatchDelete(varName) {
		_watchList.delete(varName);
		_updateWatchBody();
		_updateWatchList();
		_updateSession();
	}

	function debugBarWatchDisable() {
		_debugBarWatchDisableNoUpdate();
		_updateSession();
	}

	function debugBarWatchEnable() {
		_debugBarWatchEnableNoUpdate();
		_updateSession();
	}

	function debugBarWatchIsEnabled() {
		return !_$watchBody.attr('hidden');
	}

	function debugBarWatchToggle() {
		if (_$watchBody.attr('hidden')) {
			debugBarWatchEnable();
		}
		else {
			debugBarWatchDisable();
		}
	}


	/*******************************************************************************************************************
		Utility Functions.
	*******************************************************************************************************************/
	function _debugBarStowNoUpdate() {
		_$debugBar.css('right', `-${_$debugBar.outerWidth()}px`);
	}

	function _debugBarUnstowNoUpdate() {
		_$debugBar.css('right', 0);
	}

	function _debugBarWatchDisableNoUpdate() {
		_$watchBody.attr({
			'aria-hidden' : true,
			hidden        : 'hidden'
		});
	}

	function _debugBarWatchEnableNoUpdate() {
		_$watchBody.removeAttr('aria-hidden hidden');
	}

	function _clearSession() {
		session.delete('debugState');
	}

	function _hasSession() {
		return session.has('debugState');
	}

	function _restoreSession() {
		if (!_hasSession()) {
			return false;
		}

		const debugState = session.get('debugState');

		_stowed = debugState.stowed;

		_watchList.push(...debugState.watchList);

		if (debugState.watchEnabled) {
			_debugBarWatchEnableNoUpdate();
		}
		else {
			_debugBarWatchDisableNoUpdate();
		}

		if (debugState.viewsEnabled) {
			DebugView.enable();
		}
		else {
			DebugView.disable();
		}

		return true;
	}

	function _updateSession() {
		session.set('debugState', {
			stowed       : _stowed,
			watchList    : _watchList,
			watchEnabled : debugBarWatchIsEnabled(),
			viewsEnabled : DebugView.isEnabled()
		});
	}

	function _updateBar() {
		if (_stowed) {
			debugBarStow();
		}
		else {
			debugBarUnstow();
		}
	}

	function _updateWatchBody() {
		if (_watchList.length === 0) {
			_$watchBody
				.empty()
				.append(`<div>${L10n.get('debugBarNoWatches')}</div>`);
			return;
		}

		const delLabel = L10n.get('debugBarDeleteWatch');
		const $table   = jQuery(document.createElement('table'));
		const $tbody   = jQuery(document.createElement('tbody'));

		for (let i = 0, len = _watchList.length; i < len; ++i) {
			const varName = _watchList[i];
			const varKey  = varName.slice(1);
			const store   = varName[0] === '$' ? State.variables : State.temporary;
			const $row    = jQuery(document.createElement('tr'));
			const $delBtn = jQuery(document.createElement('button'));
			const $code   = jQuery(document.createElement('code'));

			$delBtn
				.addClass('watch-delete')
				.attr('data-name', varName)
				.ariaClick({
					one   : true,
					label : delLabel
				}, () => debugBarWatchDelete(varName));
			$code
				.text(_toWatchString(store[varKey]));

			jQuery(document.createElement('td'))
				.append($delBtn)
				.appendTo($row);
			jQuery(document.createElement('td'))
				.text(varName)
				.appendTo($row);
			jQuery(document.createElement('td'))
				.append($code)
				.appendTo($row);
			$row
				.appendTo($tbody);
		}

		$table
			.append($tbody);
		_$watchBody
			.empty()
			.append($table);
	}

	function _updateWatchList() {
		const svn = Object.keys(State.variables);
		const tvn = Object.keys(State.temporary);

		if (svn.length === 0 && tvn.length === 0) {
			_$watchList.empty();
			return;
		}

		const names   = [...svn.map(name => `$${name}`), ...tvn.map(name => `_${name}`)].sort();
		const options = document.createDocumentFragment();

		names.delete(_watchList);

		for (let i = 0, len = names.length; i < len; ++i) {
			jQuery(document.createElement('option'))
				.val(names[i])
				.appendTo(options);
		}

		_$watchList
			.empty()
			.append(options);
	}

	function _updateTurnSelect() {
		const histLen = State.size;
		const expLen  = State.expired.length;
		const options = document.createDocumentFragment();

		for (let i = 0; i < histLen; ++i) {
			jQuery(document.createElement('option'))
				.val(i)
				.text(`${expLen + i + 1}. ${Util.escape(State.history[i].title)}`)
				.appendTo(options);
		}

		_$turnSelect
			.empty()
			.ariaDisabled(histLen < 2)
			.append(options)
			.val(State.activeIndex);
	}

	function _toWatchString(value) {
		/*
			Handle the `null` primitive.
		*/
		if (value === null) {
			return 'null';
		}

		/*
			Handle the rest of the primitives and functions.
		*/
		switch (typeof value) {
		case 'number':
			if (Number.isNaN(value)) {
				return 'NaN';
			}
			else if (!Number.isFinite(value)) {
				return 'Infinity';
			}
			/* falls through */
		case 'boolean':
		case 'symbol':
		case 'undefined':
			return String(value);

		case 'string':
			return JSON.stringify(value);

		case 'function':
			return 'Function';
		}

		const objType = Util.toStringTag(value);

		// /*
		// 	Handle instances of the primitive exemplar objects (`Boolean`, `Number`, `String`).
		// */
		// if (objType === 'Boolean') {
		// 	return `Boolean\u202F{${String(value)}}`;
		// }
		// if (objType === 'Number') {
		// 	return `Number\u202F{${String(value)}}`;
		// }
		// if (objType === 'String') {
		// 	return `String\u202F{"${String(value)}"}`;
		// }

		/*
			Handle `Date` objects.
		*/
		if (objType === 'Date') {
			// return `Date\u202F${value.toISOString()}`;
			return `Date\u202F{${value.toLocaleString()}}`;
		}

		/*
			Handle `RegExp` objects.
		*/
		if (objType === 'RegExp') {
			return `RegExp\u202F${value.toString()}`;
		}

		const result = [];

		/*
			Handle `Array` & `Set` objects.
		*/
		if (value instanceof Array || value instanceof Set) {
			const list = value instanceof Array ? value : Array.from(value);

			// own numeric properties
			// NOTE: Do not use `<Array>.forEach()` here as it skips undefined members.
			for (let i = 0, len = list.length; i < len; ++i) {
				result.push(list.hasOwnProperty(i) ? _toWatchString(list[i]) : '<empty>');
			}

			// own enumerable non-numeric expando properties
			Object.keys(list)
				.filter(key => !_numericKeyRe.test(key))
				.forEach(key => result.push(`${_toWatchString(key)}: ${_toWatchString(list[key])}`));

			return `${objType}(${list.length})\u202F[${result.join(', ')}]`;
		}

		/*
			Handle `Map` objects.
		*/
		if (value instanceof Map) {
			value.forEach((val, key) => result.push(`${_toWatchString(key)} \u2192 ${_toWatchString(val)}`));

			return `${objType}(${value.size})\u202F{${result.join(', ')}}`;
		}

		/*
			General object handling.
		*/
		// own enumerable properties
		Object.keys(value)
			.forEach(key => result.push(`${_toWatchString(key)}: ${_toWatchString(value[key])}`));

		return `${objType}\u202F{${result.join(', ')}}`;
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Debug Bar Functions.
		*/
		init     : { value : debugBarInit },
		isStowed : { value : debugBarIsStowed },
		start    : { value : debugBarStart },
		stow     : { value : debugBarStow },
		toggle   : { value : debugBarToggle },
		unstow   : { value : debugBarUnstow },

		/*
			Watch Functions.
		*/
		watch : {
			value : Object.freeze(Object.defineProperties({}, {
				add       : { value : debugBarWatchAdd },
				all       : { value : debugBarWatchAddAll },
				clear     : { value : debugBarWatchClear },
				delete    : { value : debugBarWatchDelete },
				disable   : { value : debugBarWatchDisable },
				enable    : { value : debugBarWatchEnable },
				isEnabled : { value : debugBarWatchIsEnabled },
				toggle    : { value : debugBarWatchToggle }
			}))
		}
	}));
})();

/***********************************************************************************************************************

	loadscreen.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Config, Engine */

var LoadScreen = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Locks collection.
	const _locks = new Set();

	// Auto-incrementing lock ID.
	let _autoId = 0;


	/*******************************************************************************************************************
		LoadScreen Functions.
	*******************************************************************************************************************/
	/*
		Initialize management of the loading screen.
	*/
	function loadScreenInit() {
		if (DEBUG) { console.log('[LoadScreen/loadScreenInit()]'); }

		// Add a `readystatechange` listener for hiding/showing the loading screen.
		jQuery(document).on('readystatechange.SugarCube', () => {
			if (DEBUG) { console.log(`[LoadScreen/<readystatechange>] document.readyState: "${document.readyState}"; locks(${_locks.size}):`, _locks); }

			if (_locks.size > 0) {
				return;
			}

			// The value of `document.readyState` may be: 'loading' -> 'interactive' -> 'complete'.
			// Though, to reach this point, it must already be in, at least, the 'interactive' state.
			if (document.readyState === 'complete') {
				if (jQuery(document.documentElement).attr('data-init') === 'loading') {
					if (Config.loadDelay > 0) {
						setTimeout(() => {
							if (_locks.size === 0) {
								loadScreenHide();
							}
						}, Math.max(Engine.minDomActionDelay, Config.loadDelay));
					}
					else {
						loadScreenHide();
					}
				}
			}
			else {
				loadScreenShow();
			}
		});
	}

	/*
		Clear the loading screen.
	*/
	function loadScreenClear() {
		if (DEBUG) { console.log('[LoadScreen/loadScreenClear()]'); }

		// Remove the event listener.
		jQuery(document).off('readystatechange.SugarCube');

		// Clear all locks.
		_locks.clear();

		// Hide the loading screen.
		loadScreenHide();
	}

	/*
		Hide the loading screen.
	*/
	function loadScreenHide() {
		if (DEBUG) { console.log('[LoadScreen/loadScreenHide()]'); }

		jQuery(document.documentElement).removeAttr('data-init');
	}

	/*
		Show the loading screen.
	*/
	function loadScreenShow() {
		if (DEBUG) { console.log('[LoadScreen/loadScreenShow()]'); }

		jQuery(document.documentElement).attr('data-init', 'loading');
	}

	/*
		Returns a new lock ID after locking and showing the loading screen.
	*/
	function loadScreenLock() {
		if (DEBUG) { console.log('[LoadScreen/loadScreenLock()]'); }

		++_autoId;
		_locks.add(_autoId);

		if (DEBUG) { console.log(`\tacquired loading screen lock; id: ${_autoId}`); }

		loadScreenShow();
		return _autoId;
	}

	/*
		Remove the lock associated with the given lock ID and, if no locks remain,
		trigger a `readystatechange` event.
	*/
	function loadScreenUnlock(id) {
		if (DEBUG) { console.log(`[LoadScreen/loadScreenUnlock(id: ${id})]`); }

		if (id == null) { // lazy equality for null
			throw new Error('LoadScreen.unlock called with a null or undefined ID');
		}

		if (_locks.has(id)) {
			_locks.delete(id);

			if (DEBUG) { console.log(`\treleased loading screen lock; id: ${id}`); }
		}

		if (_locks.size === 0) {
			jQuery(document).trigger('readystatechange');
		}
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		init   : { value : loadScreenInit },
		clear  : { value : loadScreenClear },
		hide   : { value : loadScreenHide },
		show   : { value : loadScreenShow },
		lock   : { value : loadScreenLock },
		unlock : { value : loadScreenUnlock }
	}));
})();

/* eslint no-undef: "off", no-param-reassign: "off", no-alert: "off", no-fallthrough: "off", no-dupe-args: "warn", no-irregular-whitespace: "warn", max-len: "off", key-spacing: ["warn", {beforeColon: false, afterColon: true}], comma-dangle: ["warn", "always-multiline"], quotes: ["warn", "double"], indent: ["warn", "tab", {SwitchCase: 1}], id-length: "off", brace-style: ["warn", "1tbs"] */

/*
 * "simple" indexedDB backend for storing save data, working similarly to existing webStorage system
 * indexedDB works faster, has virtually unlimited storage, but does not work properly in private mode. then again, localStorage doesn't persist in private mode either
 * indexedDB operates asynchronously, by making requests that may be fulfilled or rejected later, without blocking the rest of the code, but also without a guarantee that requested values will be available when that rest of the code runs. this requires some working around.
 * unlike old synchronous operations, most functions do not return the value immediately, but a promise to return it when it's completed. these promises can then be used to retrieve that data by calling Promise.then() callback function
 * for example, `idb.getItem(0).then((value) => console.log(value))` will first attempt to retrieve save data from slot 0, and then when that is done - the then() function triggers, in this case printing retrieved value to the console
 *
 * this implementation doesn't rely on caches, doesn't compress save data in any way, and separates save details store from save data store to speed up building the save list and allow extra features like timestamp highlighting at minimal processing cost
 * as a consequence, it requires more disk space, and a completely separate namespace that might need extra setup for games that override the default save list appearance
 * generally though, just adding a "saveList" id or class to the div element where the saves should appear and replacing the function/macro that populates that div with "if (idb.active) idb.saveList(); else old-custom-way-of-building-save-menu" should be enough to make it work.
 */

/* global State, Story, Save, clone */

const idb = (() => {
	"use strict";

	// return early if indexedDB is unavailable
	if (window.indexedDB == null) return Object.freeze({
		lock: true,
		/* eslint-disable brace-style */
		init() { return false; },
		get active() { return false; },
		set active(_) { return false; },
		get footerHTML() { return false; },
		set footerHTML(_) { return false; },
		/* eslint-enable brace-style */
	});

	let _lock = true; // don't allow multiple operations at the same time, majority of sugarcube is not async
	let _active = true; // whether to use indexedDB or the old localStorage
	let _dbName = "idb"; // database name
	let _migrationNeeded = false; // flag to migrate old saves
	let _settings = {}; // persistent db settings stored in localStorage
	updateSettings();
	let _saveDetails = []; // cache so we don't have to query all items from details store on every page change

	function log(description, data, useClone) {
		console.log(description, useClone ? clone(data) : data);
		if (window.Errors) Errors.report(description, data, useClone);
		else alert(`${description}\n${JSON.stringify(data)}`);
	}

	// bring the database up to date
	const _version = 1;
	function dbUpgrade(ev) {
		const db = ev.target.result;
		const ver = ev.oldVersion;
		console.log("updating idb", ver);
		switch (ver) {
			case 0:
				// first time opening, create stores for fat saves and slim details
				db.createObjectStore("saves", { keyPath: "slot" });
				db.createObjectStore("details", { keyPath: "slot" });
				_migrationNeeded = true; // flag localStorage saves for migration
				break;
			case 1:
				// reserved for upgrading from ver 1 in the future
		}
	}

	// open the database
	function openDB(name = _dbName, version = _version) {
		return new Promise((resolve, reject) => {
			_dbName = name;
			const openRequest = indexedDB.open(idb.dbName, version);
			openRequest.onupgradeneeded = dbUpgrade;
			openRequest.onerror = ev => {
				const err = ev.target.error;
				log("error opening idb", err);
				reject(err);
			};
			// indexedDB is opened, mark the rest of the system as active
			openRequest.onsuccess = ev => {
				_lock = false;
				if (navigator.storage && typeof navigator.storage.persist === "function") navigator.storage.persist();
				const db = ev.target;
				db.onclose = ev => {
					_active = false;
					log("ERROR: idb connection closed unexpectedly", ev);
				};
				db.onerror = ev => {
					_active = false;
					log("Database error", ev.target.errorCode);
				};
				if (_migrationNeeded) {
					importFromLocalStorage();
					_migrationNeeded = false;
				}
				resolve(db.result);
			};
			openRequest.onblocked = () => {
				console.log("something went wrong", openRequest.error);
				// reject(openRequest.error);
			};
		});
	}

	/**
	 * synchronize internal settings with persistent storage
	 * allowing them to survive page reload
	 *
	 * @param {string} setting accessor to modify
	 * @param {boolean} value to set
	 */
	function updateSettings(setting, value) {
		const storageName = "idb-settings";
		_settings = JSON.parse(localStorage.getItem(storageName)) || {
			warnSave: V.confirmSave || false,
			warnLoad: V.confirmLoad || false,
			warnDelete: V.confirmDelete || true,
			active: !window.FCHostPersistent,
			useDelta: true,
		};
		_active = _settings.active; // one-way sync, only change default when triggered by user, not by fail-safes
		if (!setting) return;
		if (!['warnSave', 'warnLoad', 'warnDelete', 'active', 'useDelta'].includes(setting)) return console.warn(`idbupdatesettings: invalid argument: ${setting}`);
		if (value == null) return _settings[setting];
		_settings[setting] = value;
		_active = _settings.active; // do it again
		localStorage.setItem(storageName, JSON.stringify(_settings));
	}
	updateSettings();

	const baddies = [];
	/**
	 * scan and stringify functions that wormed their way into story vars
	 * and other objects with custom toJSON revivals
	 *
	 * @param {object} target to scan
	 * @param {object} path to report
	 * @param {boolean} verbose flag to report objects too complex for idb
	 */
	function funNuke(target, path = "", verbose = true) {
		if (!target) return console.log("no target specified");
		for (const key in target) {
			const value = target[key];
			const newPath = `${path}['${key}']`;
			if (value == null) continue;
			else if (typeof value === "function" || value.toJSON) {
				// we've got a baddie, round him up!
				if (verbose && V.idbTest) {
					console.log(`Warn: ${newPath} of type ${typeof value} shouldn't be in STORY variables!!!`);
				}
				target[key] = JSON.stringify(value);
				baddies.push(newPath);
			} else if (typeof value === "object") funNuke(value, newPath, verbose);
		}
	}

	/**
	 * restore nuked functions and other nasty stuff
	 *
	 * @param {object} target store to alter
	 * @param {array} paths to restore
	 */
	function ekuNnuf(target = V, paths) {
		/**
		 * sub-function to revive specified path
		 *
		 * @param {object} target
		 * @param {string} path string in a format "['path']['to']['object']"
		 * @returns true on success
		 */
		function revive(target, path) {
			if (typeof path !== "string" || path === "") return console.log("Warn: invalid path", clone(path));
			const accessors = path.slice(2,-2).split("']['");
			let ref = target;
			for (let i = 0, destination = accessors.length - 1; i <= destination; i++) {
				if (i === destination) ref[accessors[i]] = JSON.parse(ref[accessors[i]]);
				else ref = ref[accessors[i]];
			}
			return true;
		}

		let path = "";
		while (path = paths.shift()) {
			try {
				revive(target, path);
			} catch (ex) {
				console.log("WARN: couldn't restore story var function", path);
			}
		}
	}

	/**
	 * copy saves from localStorage into indexedDB, without regard for what's already in there
	 *
	 * @returns {boolean} success of the operation
	 */
	async function importFromLocalStorage() {
		function processSave(fullSaveObj) {
			const save = fullSaveObj.state;
			if (save.jdelta) delete save.jdelta; // jdelta wasn't a great idea
			if (save.delta) save.history = State.deltaDecode(save.delta);
			delete save.delta;
			if (window.DoLSave) DoLSave.decompressIfNeeded({ state: save });

			const vars = save.history[save.index].variables;
			if (!vars.saveId) {
				// assign saveId, use Math.random() to not trip prng
				const saveId = Math.floor(Math.random() * 90000) + 10000;
				save.history.forEach(s => s.variables.saveId = saveId);
			}

			const details = {
				date: fullSaveObj.date,
				id: fullSaveObj.id,
				idx: fullSaveObj.idx,
				title: fullSaveObj.title,
				metadata: fullSaveObj.metadata || { saveId: vars.saveId, saveName: vars.saveName },
			};

			return [save, details];
		}

		let mtCount = 0;
		const oldSaves = Save.get();
		const autoSave = oldSaves.autosave;
		if (autoSave != null) {
			// autosave was moved from a separate slot in old system to just 0
			// if multiple autosaves are to be implemented, they can use negative slot numbers
			const saveData = processSave(save);
			// setItem only allows one operation at a time to prevent possible exploits, so wait for it to finish
			await setItem(0, saveData[0], { slot: 0, data: saveData[1] });
		} else mtCount++;
		for (let i = 0; i < oldSaves.slots.length; i++) {
			const slotSave = oldSaves.slots[i];
			if (slotSave != null) {
				const saveData = processSave(slotSave);
				await setItem(i + 1, saveData[0], { slot: i + 1, data: saveData[1] });
			} else mtCount++;
		}
		if (mtCount === oldSaves.slots.length + 1) { // all slots are empty, different storage method?
			const index = storage.get("index");
			if (index && index.slots) {
				// fc-like
				const autosave = storage.get("autosave");
				if (autosave) {
					const saveData = processSave(autosave);
					await setItem(0, saveData[0], { slot: 0, data: saveData[1] });
				}
				for (let i = 0; i < index.slots.length; i++) {
					const slotSave = storage.get("slot" + i); // eslint-disable-line prefer-template
					if (!slotSave) continue;
					const saveData = processSave(slotSave);
					await setItem(i + 1, saveData[0], { slot: i + 1, data: saveData[1] });
				}
			}
		}
		await getSaveDetails().then(d => _saveDetails = d);
		console.log("idb migration successful");
		return true;
	}

	/**
	 * turn transaction event handlers into promises
	 *
	 * @param {Request} transaction
	 */
	function makePromise(transaction) {
		return new Promise((resolve, reject) => {
			transaction.onsuccess = () => {
				_lock = false;
				return resolve(transaction.result);
			};
			transaction.oncomplete = () => {
				_lock = false;
				return resolve(transaction.result);
			};
			transaction.onerror = ev => {
				_lock = false;
				_active = false;
				console.log(transaction.error, ev, "error");
				return reject(transaction.error);
			};
			transaction.onabort = () => {
				_lock = false;
				console.log("aborted", transaction.error);
				return reject(transaction.error);
			};
		});
	}

	/**
	 * retrieve an item from indexedDB
	 *
	 * @param {number} slot
	 * @returns {Promise} promise to return a value some day
	 */
	async function getItem(slot) {
		const db = await openDB();
		const transactionRequest = db.transaction("saves", "readonly");
		const item = transactionRequest.objectStore("saves").get(slot);
		const result = await makePromise(item).catch(err => log(`couldn't retrieve idb item in slot ${slot}`, err));
		db.close();
		return result;
	}

	/**
	 * place a save object into saves store and a provided or calculated details object into details store
	 * will replace existing object in specified slot without a second thought
	 *
	 * @param {number} slot slot to write into
	 * @param {object} saveObj valid save object with unencoded history
	 * @param {object} details optional save details to override what's going into details store
	 * @returns {Promise | undefined} promise to report on success of this operation some day or return early
	 */
	async function setItem(slot, saveObj, details) {
		if (_lock) return;
		if (saveObj == null || !Object.hasOwn(saveObj, "history")) return false;
		_lock = true;

		// prepare save details
		const savesItem = { slot, data: saveObj };
		const saveVars = saveObj.history[saveObj.index].variables;
		const metadata = Object.assign({ saveId: saveVars.saveId, saveName: saveVars.saveName }, details?.metadata);
		details.metadata = metadata;
		const detailsItem = details
			? {
				slot,
				data: details,
			}
			: {
				slot,
				data: {
					id: Story.domId,
					idx: State.qc,
					title: Story.get(State.passage).description(),
					date: Date.now(),
					metadata,
				},
			};

		// expect failures here
		try {
			// sanitize complex data structures that can't be stored in idb
			let counter = 0; // only report problems for the first frame
			saveObj.history.forEach(s => {
				baddies.splice(0); // clear the baddies
				funNuke(s.variables, "", !counter++); // wrap up new baddies
				if (baddies.length) s.baddies = clone(baddies); // seal the records
			});
			if (_settings.useDelta && slot !== 0) {
				// compress the history, some games are really space-hungry
				// autosaves are exempt because performance reasons
				saveObj.delta = State.deltaEncode(saveObj.history);
				delete saveObj.history;
			}

			const db = await openDB();

			const transactionRequest = db.transaction(["saves", "details"], "readwrite");
			transactionRequest.objectStore("saves").delete(slot);
			transactionRequest.objectStore("saves").add(savesItem);
			transactionRequest.objectStore("details").delete(slot);
			transactionRequest.objectStore("details").add(detailsItem);

			const result = await makePromise(transactionRequest).catch(err => log(`couldn't put idb item in slot ${slot}`, err));
			db.close();
			return result;
		} catch (ex) {
			// admit the defeat and go home
			log(`idb.setItem failure unknown. Couldn't complete the save in slot ${slot}`);
			_lock = false;
			// return a promise, because some code down the line expects .then()
			return new Promise(resolve => resolve(false));
		}
	}

	/**
	 * delete save data in a specified slot
	 *
	 * @param {number} slot
	 * @returns {Promise | undefined} promise to report on success or return early
	 */
	async function deleteItem(slot) {
		if (_lock) return;
		const db = await openDB();

		_lock = true;
		const transactionRequest = db.transaction(["saves", "details"], "readwrite");
		transactionRequest.objectStore("saves").delete(slot);
		transactionRequest.objectStore("details").delete(slot);
		const result = await makePromise(transactionRequest);
		db.close();
		await getSaveDetails();
		return result;
	}

	/**
	 * actually load a save from idb
	 *
	 * @param {number} slot
	 */
	async function loadState(slot) {
		if (_lock) return;
		const data = await getItem(slot);
		if (data == null) return false;
		const state = data.data;
		// restore history
		if (state.delta) {
			state.history = State.deltaDecode(state.delta);
			delete state.delta;
		}
		// restore complex structures
		state.history.forEach(s => {
			if (s.baddies) {
				ekuNnuf(s.variables, s.baddies);
				delete s.baddies;
			}
		});
		// reconstruct fullSaveObj expected by onLoad
		const details = _saveDetails.find(d => d.slot === slot)?.data;
		state.idx = details.idx;
		const fullSaveObj = Object.assign({ state }, details);
		Save.onLoad.handlers.forEach(fn => fn(fullSaveObj));
		State.unmarshalForSave(state);
		State.show();
	}

	/**
	 * save current game into idb
	 *
	 * @param {number} slot
	 * @param {string} title
	 * @param {object} metadata
	 */
	async function saveState(slot, title, metadata) {
		if (_lock) return;

		// assign V.saveId if necessary
		if (!V.saveId) {
			const saveId = Math.floor(Math.random() * 90000) + 10000;
			V.saveId = saveId;
			State.history.forEach(s => s.variables.saveId = saveId);
		}

		// saveObj goes into saves db, the rest goes into details db
		const saveObj = State.marshalForSave();
		// we combine state and details into a single big object because that's what onSave expects
		const fullSaveObj = {
			state: saveObj,
			date: Date.now(),
			id: Story.domId,
			idx: State.qc,
			title: title || Story.get(State.passage).description(),
		};
		if (metadata != null) fullSaveObj.metadata = metadata;

		// run onSave handlers
		Save.onSave.handlers.forEach(fn => fn(fullSaveObj, { type: slot <= 0 ? "autosave" : "slot" }));

		// weird as object pointers are in js, it is now safe to remove .state from fullSaveObj, leaving only save details. so, let's rename it to reflect that
		const details = fullSaveObj;
		delete details.state;

		// finally, send everything to idb and synchronize _saveDetails
		if (saveObj != null) {
			await setItem(slot, saveObj, details);
			await getSaveDetails();
			return true;
		}
		return false;
	}

	/**
	 * retrieve details for all saves from idb and also cache them to _saveDetails for fast retrieval
	 *
	 * @returns {Promise<array>} list of details for all saves in idb
	 */
	async function getSaveDetails() {
		const db = await openDB();
		// const db = request.result;
		const transactionRequest = db.transaction(["details"], "readonly");
		const details = await makePromise(transactionRequest.objectStore("details").getAll());
		db.close();
		// warning: async quirks
		_saveDetails = details; // here, details is an array
		return details; // but the function returns a promise resolved to that array, not the array itself
	}

	/**
	 * get DATA for ALL saves in the db
	 * WILL fail if db is bigger than 2gb (and probably earlier)
	 *
	 * @returns {Array} list of data for all saves in idb
	 */
	async function getAllSaves() {
		const db = await openDB();
		const transactionRequest = db.transaction(["saves"], "readonly");
		const saves = transactionRequest.objectStore("saves").getAll();
		const result = await makePromise(saves)
		db.close();

		return result;
	}

	/**
	 * mercilessly clear all object stores one step short from outright deleting the db itself
	 *
	 * @returns {Promise | undefined} promise to maybe report when the deed is done or return early
	 */
	async function clearAll() {
		if (_lock) return;
		const db = await openDB();
		const transactionRequest = db.transaction(["saves", "details"], "readwrite");
		transactionRequest.objectStore("saves").clear();
		transactionRequest.objectStore("details").clear();
		_saveDetails = [];

		return makePromise(transactionRequest);
	}

	/**
	 * check if saves are allowed
	 */
	function savesAllowed() {
		return typeof Config.saves.isAllowed !== "function" || Config.saves.isAllowed();
	}

	/**
	 * define saveList variables
	 */

	let listLength; // store save list length in idb
	let listPage; // same with the current page
	const listLengthMax = 20; // maximum number of rows
	const listPageMax = 20; // maximum number of pages
	let latestSave = { slot: 1, date: 0 }; // keep track of the most recent save, separately from autosave on slot 0
	let extraSaveWarn;
	let footerHTML = ""; // add some text to fill empty space at the deleteAll button

	/**
	 * construct a saves list page, with configurable length
	 *
	 * @param {number} page
	 * @param {number} length
	 * @returns {DocumentFragment};
	 */
	function generateSavesPage(page = listPage - 1, length = listLength) {
		const listContainer = document.createElement("div");
		listContainer.id = "saves-list-container";
		listContainer.appendChild(generateHeaderRow());
		// cache whether saves are allowed
		const saveUnlock = savesAllowed();

		// find the most recent save that is not autosave
		latestSave = { slot: 1, date: 0 }; // re-init latest slot every time
		let autoSaveDate; // store timestamp for the autosave separately
		_saveDetails.forEach(d => {
			if (d.slot === 0) autoSaveDate = d.data.date;
			else if (d.data.date > latestSave.date) {
				latestSave.slot = d.slot;
				latestSave.date = d.data.date;
			}
		});
		// default list length is set here
		if (!listLength) {
			// idb is indexed by slot, so the highest is always last
			const slot = _saveDetails.length ? _saveDetails.last().slot : 0;
			// adjust list length to include saves in the highest slot
			// max pages is 20 (still too low if you're using 1080x1920 portrait mode)
			// by default, list length is 10, resulting into up to 200 slots across 20 pages
			// max list length is 20, resulting into up to 400 slots
			// having a save anywhere in slots > 200 shall increase list length so it won't disappear
			// it can also be used to increase default list length without any extra variables
			for (listLength = 10; slot > listLength * listPageMax && listLength < listLengthMax; listLength++);
			length = listLength;
		}
		// if not set to a correct value, show the page with the most recent save
		if (!Number.isInteger(page)) {
			// autosave is shown on every page, so if autosave is the most recent save - open the page with the most recent non-autosave with the same ID
			const latestSlot = _saveDetails.find(d => d.slot === latestSave.slot);
			if (latestSlot) {
				const autoSaveExists = Boolean(_saveDetails.find(d => d.slot === 0));
				const ignoreAutoSave = latestSlot.data.date > autoSaveDate || latestSlot.data.metadata.saveId === _saveDetails[0].data.metadata.saveId;
				if (!autoSaveExists || ignoreAutoSave) page = Math.floor((latestSave.slot - 1) / length);
				else page = 0;
			} else page = 0;
			listPage = page + 1;
		}

		// getSaveDetails can take longer to init listLength and listPage than it takes for their fields to be placed on page, gotta update them in such case
		const pageField = document.getElementById("pageNum");
		if (pageField != null) pageField.value = listPage;
		const lengthField = document.getElementById("pageLen");
		if (lengthField != null) lengthField.value = listLength;

		// default object details for an empty slot
		const defaultDetailsObj = { date: "", title: "", metadata: { saveId: "", saveName: "" } };

		// always show autosave on top
		const autoDetailsObj = _saveDetails.find(d => d.slot === 0)?.data ?? clone(defaultDetailsObj);
		if (autoSaveDate > latestSave.date) autoDetailsObj.latestSlot = true;
		autoDetailsObj.slot = 0;
		// don't show if autosaves are disabled by the engine
		if (Save.autosave.ok())	listContainer.appendChild(generateSaveRow(autoDetailsObj));

		// main loop for adding the save rows
		for (let slot = length * page + 1; slot < length * (page + 1) + 1; slot++) {
			// create default details
			let detailsObj = clone(defaultDetailsObj);
			// if a save exists in idb, replace the details with recorded ones
			const detailsIndex = _saveDetails.findIndex(d => d.slot === slot);
			if (detailsIndex !== -1) {
				detailsObj = _saveDetails[detailsIndex].data;
				// add a flag to highlight the most recent save
				if (Number(latestSave.slot) === slot) detailsObj.latestSlot = true;
			}
			detailsObj.slot = slot;
			detailsObj.saveUnlock = saveUnlock;
			listContainer.appendChild(generateSaveRow(detailsObj));
		}

		return listContainer;
	}

	/**
	 * construct the header row for the save list
	 * warning: unnecessarily complicated DOM manipulations
	 *
	 * @returns {DocumentFragment} header row
	 */
	function generateHeaderRow() {
		const frag = document.createDocumentFragment();
		const saveListHeader = document.createElement("div");
		saveListHeader.className = "savesListRow";
		frag.appendChild(saveListHeader);

		const headerSaveGroup = document.createElement("div");
		headerSaveGroup.className = "saveGroup";
		saveListHeader.appendChild(headerSaveGroup);

		const headerSaveId = document.createElement("div");
		headerSaveId.className = "saveId";
		headerSaveId.innerText = "#";
		headerSaveGroup.appendChild(headerSaveId);

		const headerSaveButton = document.createElement("div");
		headerSaveButton.className = "saveButton";
		headerSaveButton.innerText = L10n.get("savesHeaderSaveLoad");
		headerSaveGroup.appendChild(headerSaveButton);

		const headerSaveName = document.createElement("div");
		headerSaveName.className = "saveName";
		headerSaveName.innerText = L10n.get("savesHeaderIDName");
		headerSaveGroup.appendChild(headerSaveName);

		const headerSaveDetails = document.createElement("div");
		headerSaveDetails.className = "saveDetails";
		headerSaveDetails.innerText = L10n.get("savesHeaderDetails");
		headerSaveGroup.appendChild(headerSaveDetails);

		const headerDeleteButton = document.createElement("div");
		headerDeleteButton.className = "deleteButton";
		headerSaveGroup.appendChild(headerDeleteButton);

		return frag;
	}

	/**
	 * construct the footer row for the save list
	 * warning: unnecessarily complicated DOM manipulations
	 *
	 * @returns {HTMLUListElement} footer row
	 */
	function generateFooterRow() {
		const container = document.createElement("ul");
		container.className = "buttons";
		let li;

		// save to file button
		const exportButton = document.createElement("button");
		exportButton.id = "saves-export";
		exportButton.className = "ui-close";
		exportButton.innerText = L10n.get("savesLabelExport");
		if (savesAllowed()) {
			exportButton.onclick = () => Save.export();
			exportButton.classList.add("saveMenuButton");
		} else exportButton.disabled = true;
		li = document.createElement("li");
		li.appendChild(exportButton);
		container.appendChild(li);

		// save to clipboard button
		if (navigator.clipboard) {
			const toClipboardButton = document.createElement("button");
			toClipboardButton.id = "saves-toClipboard";
			toClipboardButton.className = "ui-close";
			toClipboardButton.innerText = L10n.get("savesLabelToClipboard");
			if (savesAllowed()) {
				toClipboardButton.onclick = () => {
					navigator.clipboard.writeText(Save.serialize());
					window.closeOverlay();
				};
				toClipboardButton.classList.add("saveMenuButton");
			} else toClipboardButton.disabled = true;
			li = document.createElement("li");
			li.appendChild(toClipboardButton);
			container.appendChild(li);
		}

		// load from file button
		const importButton = document.createElement("button");
		importButton.id = "saves-import";
		importButton.className = "saveMenuButton";
		importButton.innerText = L10n.get("savesLabelImport");
		importButton.onclick = () => {
			jQuery(document.createElement("input")).prop("type", "file").on("change", SugarCube.Save.import).trigger("click"); // gotta give it to anthaum for finding this
			window.closeOverlay();
		};
		li = document.createElement("li");
		li.appendChild(importButton);
		container.appendChild(li);

		// delete all saves button
		const clearAllButton = document.createElement("button");
		clearAllButton.className = "saves-clear saveMenuButton";
		clearAllButton.innerText = L10n.get("savesLabelClear");
		clearAllButton.onclick = () => saveList("confirm clear");
		li = document.createElement("li");
		li.appendChild(clearAllButton);
		container.appendChild(li);

		return container;
	}

	/**
	 * optional extra footer row
	 */
	function generateExtraFooterRow() {
		if (!footerHTML) return null;
		const container = document.createElement("ul");
		container.className = "buttons";
		container.innerHTML = footerHTML;

		return container;
	}

	/**
	 * all this to generate a single saves row from provided details
	 * pure js dom manipulations are ugly
	 *
	 * @param {object} details save details
	 * @returns {DocumentFragment}
	 */
	function generateSaveRow(details) {
		// save row to be returned
		const row = document.createElement("div");
		// add a fancy transition that would highlight the row with this id
		if (details.latestSlot && details.slot !== 0) row.id = "latestSaveRow";
		row.className = "savesListRow";

		// save group container
		const group = document.createElement("div");
		group.className = "saveGroup";

		// save ID
		const saveId = document.createElement("div");
		saveId.className = "saveId";
		saveId.innerText = details.slot === 0 ? "A" : details.slot;
		if (details.slot > listPageMax * listLengthMax || details.slot < 0) saveId.classList.add("red");

		// save/load buttons container
		const saveload = document.createElement("div");
		saveload.className = "saveButton";

		// save button
		const saveButton = document.createElement("button");
		saveButton.innerText = L10n.get("savesLabelSave");
		if (details.saveUnlock) {
			saveButton.className = "saveMenuButton";
			saveButton.onclick = () => saveList("confirm save", details);
		} else {
			saveButton.disabled = true;
		}

		// load button
		const loadButton = document.createElement("button");
		loadButton.innerText = L10n.get("savesLabelLoad");
		if (details.date) {
			loadButton.className = "saveMenuButton";
			loadButton.onclick = () => saveList("confirm load", details);
		} else {
			loadButton.disabled = true;
		}
		if (details.slot !== 0) saveload.appendChild(saveButton);
		saveload.appendChild(loadButton);

		// save name
		const saveName = document.createElement("div");
		saveName.className = "saveName";
		// highlight saves with currently loaded save's id
		if (V.saveId === details.metadata.saveId) saveName.classList.add("gold");
		saveName.innerText = details.metadata.saveName ? details.metadata.saveName.slice(0, 10) : details.metadata.saveId;

		// save details
		const saveDetails = document.createElement("div");
		saveDetails.className = "saveDetails";
		// description
		const description = document.createElement("span");
		description.innerText = details.title || "\xa0";
		// date stamp
		const date = document.createElement("span");
		date.className = "datestamp";
		if (details.date) {
			// highlight (most) recent save(s)
			if (details.latestSlot) date.classList.add("green");
			else if (details.date > Date.now() - 1800000) date.classList.add("gold");
			date.innerText = new Date(details.date).toLocaleString();
		} else date.innerText = "\xa0";
		saveDetails.appendChild(description);
		saveDetails.appendChild(date);

		// delete button
		const deleteButton = document.createElement("button");
		deleteButton.className = "deleteButton right";
		deleteButton.innerText = L10n.get("savesLabelDelete");
		if (details.date) {
			deleteButton.classList.add("saveMenuButton");
			deleteButton.onclick = () => saveList("confirm delete", details);
		} else {
			deleteButton.disabled = true;
		}

		group.append(saveId, saveload, saveName, saveDetails);
		row.appendChild(group);
		row.appendChild(deleteButton);

		return row;
	}

	/**
	 * @returns {HTMLUListElement}
	 */
	function generatePager() {
		const container = document.createElement("ul");
		container.className = "buttons";
		let li;

		li = document.createElement("li");
		li.append(L10n.get("savesPagerPage"));
		container.appendChild(li);

		// previous page button
		const prevPage = document.createElement("button");
		prevPage.append("<");
		if (listPage > 1) {
			prevPage.classList.add("saveMenuButton");
			prevPage.onclick = () => {
				--listPage;
				saveList("show saves");
			};
		} else prevPage.disabled = true;
		li = document.createElement("li");
		li.appendChild(prevPage);
		container.appendChild(li);


		// page number input
		const pageNum = document.createElement("input");
		Object.assign(pageNum, {
			id: "pageNum",
			type: "number",
			value: listPage,
			style: "width: 3em",
			min: 1,
			max: listPageMax,
			onchange: () => {
				listPage = Math.clamp(Math.round(pageNum.value), 1, listPageMax);
				saveList("show saves");
			},
		});
		container.appendChild(pageNum); // Not in a li to keep closer to buttons

		// next page button
		const nextPage = document.createElement("button");
		nextPage.append(">");
		if (listPage < listPageMax) {
			nextPage.classList.add("saveMenuButton");
			nextPage.onclick = () => {
				++listPage;
				saveList("show saves");
			};
		} else nextPage.disabled = true;
		nextPage.onclick = () => {
			if (listPage < listPageMax) listPage++;
			saveList("show saves");
		};
		li = document.createElement("li");
		li.appendChild(nextPage);
		container.appendChild(li);

		li = document.createElement("li");
		li.append(L10n.get("savesPagerSavesPerPage"));
		container.appendChild(li);

		// list length input
		const pageLen = document.createElement("input");
		Object.assign(pageLen, {
			id: "pageLen",
			type: "number",
			value: listLength,
			style: "width: 3em",
			min: 1,
			max: listLengthMax,
			onchange: () => {
				listLength = Math.clamp(pageLen.value, 1, listLengthMax);
				saveList("show saves");
			},
		});
		li = document.createElement("li");
		li.append(pageLen);
		container.appendChild(li);

		// jump to most recent save button
		const jumpToLatest = document.createElement("button");
		jumpToLatest.className = "saveMenuButton";
		jumpToLatest.innerText = L10n.get("savesPagerJump");
		jumpToLatest.onclick = () => {
			// potentially exploitable to allow saving to slots way above the limit, but the limit is arbitrary to begin with, and idb doesn't actually suffer one bit from going beyond that limit
			listPage = Math.floor((latestSave.slot - 1) / listLength + 1);
			saveList("show saves");
			setTimeout(() => {
				const el = document.getElementById("latestSaveRow");
				if (el != null) {
					el.classList.remove("jumpToSaveTransition");
					el.classList.add("jumpToSaveTransition");
				}
			}, Engine.minDomActionDelay + 100);
		};
		li = document.createElement("li");
		li.appendChild(jumpToLatest);
		container.appendChild(li);

		return container;
	}

	// itch app must die or at least update to kitch version, smh
	const replaceChildren = !!document.body.replaceChildren;

	// alias for closing the saves menu
	if (typeof window.closeOverlay === "undefined") window.closeOverlay = Dialog.close;

	/**
	 * replace contents of saveList div with something useful
	 *
	 * @param {string} mode switch for displaying saves list or confirmations
	 * @param {object} details save details for confirmations
	 */
	async function saveList(mode, details) {
		if (_active && !_settings.active) updateSettings("active", true); // for when it's called from old save menu
		if (!mode) {
			// update saveDetails every time menu opens with no options, in case game was saved in another tab
			await getSaveDetails();
			mode = "show saves";
		}

		await new Promise(r => setTimeout(() => r(true), 0)); // this actually ensures that #saveList had time to render into DOM
		const savesDiv = document.getElementById("saveList") || document.getElementsByClassName("saveList")[0] || document.getElementsByClassName("saves")[0];
		const list = document.createDocumentFragment();

		// prepare a re-usable cancel button
		const cancelButton = document.createElement("button");
		cancelButton.className = "saveMenuButton saveMenuConfirm";
		cancelButton.innerText = L10n.get("cancel");
		cancelButton.onclick = () => saveList("show saves");

		// prepare old save info (if provided)
		function generateOldSaveDescription(details) {
			const oldSaveDescription = document.createDocumentFragment();
			if (!details || !details.date) return oldSaveDescription;

			const oldSaveTitle = document.createElement("p");
			oldSaveTitle.innerText = `${L10n.get("savesDescTitle")} ${details.title}`;

			const oldSaveData = document.createElement("p");
			oldSaveData.innerText = `${details.metadata.saveName ? L10n.get("savesDescName") + details.metadata.saveName : L10n.get("savesDescId") + details.metadata.saveId} ${L10n.get("savesDescDate")} ${new Date(details.date).toLocaleString()}`;

			oldSaveDescription.append(oldSaveTitle, oldSaveData);

			return oldSaveDescription;
		}

		switch (mode) {
			case "show saves": {
				// print saves list
				// show the warnings
				if (!savesAllowed()) {
					const notAllowedWarning = document.createElement("h3");
					notAllowedWarning.className = "red";
					notAllowedWarning.innerText = V.replayScene ? L10n.get("savesDisallowedReplay") : L10n.get("savesDisallowed");
					list.appendChild(notAllowedWarning);
				}

				const exportReminder = document.createElement("p");
				exportReminder.id = "saves-export-reminder";
				exportReminder.innerText = L10n.get("savesExportReminder");
				list.appendChild(exportReminder);

				// extra saves warning
				if (extraSaveWarn) {
					const lostSaves = document.createElement("p");
					lostSaves.innerHTML = "<i class=\"description\"><u>Where are my saves?</u></i> ";
					const lostSavesTooltip = document.createElement("mouse");
					lostSavesTooltip.classList.add("tooltip", "linkBlue");
					lostSavesTooltip.innerText = "(?)";
					lostSavesTooltip.appendChild(document.createElement("span"));
					lostSavesTooltip.lastChild.innerText = "If you can't find your saves, it's possible you saved them using a different storage method. Try toggling the \"Use old legacy storage\" option below the saves list.";
					lostSaves.appendChild(lostSavesTooltip);
					list.appendChild(lostSaves);
				}

				// THE SAVES LIST
				list.appendChild(generateSavesPage());

				// button row
				list.appendChild(generateFooterRow());

				// optional footer row
				if (footerHTML) list.appendChild(generateExtraFooterRow());

				// add pager
				list.appendChild(generatePager());

				// add confirmation toggles
				let ul = document.createElement("ul");
				ul.className = "buttons";
				let li;
				li = document.createElement("li");
				li.append(L10n.get("savesOptionsConfirmOn"));
				ul.appendChild(li);

				const reqSaveLabel = document.createElement("label");
				reqSaveLabel.innerText = L10n.get("savesOptionsOverwrite");
				const reqSave = document.createElement("input");
				reqSave.type = "checkbox";
				reqSave.checked = _settings.warnSave;
				reqSave.onchange = () => updateSettings("warnSave", reqSave.checked);
				reqSaveLabel.appendChild(reqSave);
				li = document.createElement("li");
				li.appendChild(reqSaveLabel);
				ul.appendChild(li);

				const reqLoadLabel = document.createElement("label");
				reqLoadLabel.innerText = L10n.get("savesLabelLoad");
				const reqLoad = document.createElement("input");
				reqLoad.type = "checkbox";
				reqLoad.checked = _settings.warnLoad;
				reqLoad.onchange = () => updateSettings("warnLoad", reqLoad.checked);
				reqLoadLabel.appendChild(reqLoad);
				li = document.createElement("li");
				li.appendChild(reqLoadLabel);
				ul.append("|", li);

				const reqDeleteLabel = document.createElement("label");
				reqDeleteLabel.innerText = L10n.get("savesLabelDelete");
				const reqDelete = document.createElement("input");
				reqDelete.type = "checkbox";
				reqDelete.checked = _settings.warnDelete;
				reqDelete.onchange = () => updateSettings("warnDelete", reqDelete.checked);
				reqDeleteLabel.appendChild(reqDelete);
				li = document.createElement("li");
				li.appendChild(reqDeleteLabel);
				ul.append("|", li);

				// last element gets floated to the right. empty one doesn't matter
				ul.append(document.createElement("li"));

				list.append(ul);

				// add instant idb switcher
				ul = document.createElement("ul");
				ul.className = "buttons";
				const idbtoggle = document.createElement("button");
				idbtoggle.id = "saves-idb-toggle";
				idbtoggle.className = "saveMenuButton";
				idbtoggle.innerText = L10n.get("savesOptionsUseLegacy");
				idbtoggle.onclick = () => {
					updateSettings("active", false);
					if (window.DoLSave)	$.wiki("<<replace #saveList>><<saveList>><</replace>>");
					else UI.buildSaves();
				};
				li = document.createElement("li");
				li.appendChild(idbtoggle);
				ul.appendChild(li);
				list.appendChild(ul);

				setTimeout(() => {
					if (replaceChildren) savesDiv.replaceChildren(list);
					else { // curse you, itch app!
						savesDiv.innerHTML = "";
						savesDiv.appendChild(list);
					}
					const pageField = document.getElementById("pageNum");
					if (pageField != null) pageField.value = listPage;
					const lengthField = document.getElementById("pageLen");
					if (lengthField != null) lengthField.value = listLength;
					Dialog.resize(); // fix dialog size
				}, Engine.minDomActionDelay);
				break;
			}
			case "confirm save": {
				// skip confirmation if the slot is empty, but do not skip on saveId mismatch, even if confirmation is not required
				if (!details.date || !_settings.warnSave && details.metadata.saveId === V.saveId) return saveState(details.slot).then(window.closeOverlay());
				const confirmSaveWarning = document.createElement("div");
				confirmSaveWarning.className = "saveBorder";

				const confirmSaveWarningTitle = document.createElement("h3");
				confirmSaveWarningTitle.className = "red";
				confirmSaveWarningTitle.innerText = `${details.date === "" ? L10n.get("savesWarningSaveOnSlot") : L10n.get("savesWarningOverwriteSlot")} ${details.slot}?`;

				if (details.date && V.saveId !== details.metadata.saveId) {
					const overwriteWarning = document.createElement("span");
					overwriteWarning.className = "red";
					overwriteWarning.innerText = L10n.get("savesWarningOverwriteID");
				}

				const saveButton = document.createElement("input");
				Object.assign(saveButton, {
					type: "button",
					className: "saveMenuButton saveMenuConfirm",
					value: L10n.get("savesLabelSave"),
					onclick: () => saveState(details.slot).then(() => window.closeOverlay()),
				});
				confirmSaveWarning.append(confirmSaveWarningTitle, generateOldSaveDescription(details), saveButton, cancelButton);

				list.appendChild(confirmSaveWarning);
				setTimeout(() => {
					if (replaceChildren) savesDiv.replaceChildren(list);
					else { // curse you, itch app!
						savesDiv.innerHTML = "";
						savesDiv.appendChild(list);
					}
				}, Engine.minDomActionDelay);
				break;
			}
			case "confirm delete": {
				// skip confirmation if corresponding toggle is off
				if (!_settings.warnDelete) return deleteItem(details.slot).then(() => saveList("show saves"));
				const confirmDeleteWarning = document.createElement("div");
				confirmDeleteWarning.className = "saveBorder";
				const confirmDeleteWarningTitle = document.createElement("h3");
				confirmDeleteWarningTitle.className = "red";
				confirmDeleteWarningTitle.innerText = `${L10n.get("savesWarningDeleteInSlot") + (details.slot === 0 ? "auto" : details.slot)}?`;

				const deleteButton = document.createElement("input");
				Object.assign(deleteButton, {
					type: "button",
					className: "saveMenuButton saveMenuConfirm",
					value: L10n.get("savesLabelDelete"),
					onclick: () => deleteItem(details.slot).then(() => saveList("show saves")),
				});

				confirmDeleteWarning.append(confirmDeleteWarningTitle, generateOldSaveDescription(details), deleteButton, cancelButton);

				list.appendChild(confirmDeleteWarning);
				setTimeout(() => {
					if (replaceChildren) savesDiv.replaceChildren(list);
					else { // curse you, itch app!
						savesDiv.innerHTML = "";
						savesDiv.appendChild(list);
					}
				}, Engine.minDomActionDelay);
				break;
			}
			case "confirm load": {
				// skip confirmation if corresponding toggle is off
				if (!_settings.warnLoad) return loadState(details.slot).then(() => window.closeOverlay());
				const confirmLoad = document.createElement("div");
				confirmLoad.className = "saveBorder";
				const confirmLoadTitle = document.createElement("h3");
				confirmLoadTitle.className = "red";
				confirmLoadTitle.innerText = `${L10n.get("savesWarningLoad") + (details.slot === 0 ? "auto" : details.slot)}?`;

				const loadButton = document.createElement("input");
				Object.assign(loadButton, {
					type: "button",
					className: "saveMenuButton saveMenuConfirm",
					value: L10n.get("savesLabelLoad"),
					onclick: () => idb.loadState(details.slot).then(() => window.closeOverlay()),
				});
				confirmLoad.append(confirmLoadTitle, generateOldSaveDescription(details), loadButton, cancelButton);

				list.appendChild(confirmLoad);
				setTimeout(() => {
					if (replaceChildren) savesDiv.replaceChildren(list);
					else { // curse you, itch app!
						savesDiv.innerHTML = "";
						savesDiv.appendChild(list);
					}
				}, Engine.minDomActionDelay);
				break;
			}
			case "confirm clear": {
				// storage wipes always require confirmation
				const confirmClear = document.createElement("div");
				confirmClear.className = "saveBorder";
				const confirmClearTitle = document.createElement("h2");
				confirmClearTitle.className = "red";
				confirmClearTitle.innerText = L10n.get("savesWarningDeleteAll");

				const clearButton = document.createElement("input");
				Object.assign(clearButton, {
					type: "button",
					className: "saveMenuButton saveMenuConfirm",
					value: L10n.get("savesLabelClear"),
					onclick: () => clearAll().then(() => saveList("show saves")),
				});
				confirmClear.append(confirmClearTitle, clearButton, cancelButton);

				list.appendChild(confirmClear);
				setTimeout(() => {
					if (replaceChildren) savesDiv.replaceChildren(list);
					else { // curse you, itch app!
						savesDiv.innerHTML = "";
						savesDiv.appendChild(list);
					}
				}, Engine.minDomActionDelay);
				break;
			}
		}
	}

	return Object.freeze(Object.defineProperties({}, {
		/* eslint-disable brace-style */
		dbName:         { get() { return _dbName;    }, set(val) { _dbName = val; } },
		lock:           { get() { return _lock;      }, set(val) { _lock = Boolean(val); } },
		active:         { get() { return _active;    }, set(val) { _active = Boolean(val); } },
		listLength:     { get() { return listLength; }, set(val) { listLength = val; } },
		listPage:       { get() { return listPage;   }, set(val) { listPage = val; } },
		footerHTML:     { get() { return footerHTML; }, set(val) { footerHTML = val; } },
		baddies:        { get() { return baddies; } },
		init:           { value(dbName) { return openDB(dbName); } },
		getSaveDetails: { value: getSaveDetails },
		getAllSaves:    { value: getAllSaves },
		saveList:       { value: saveList },
		saveState:      { value: saveState },
		loadState:      { value: loadState },
		setItem:        { value: setItem },
		getItem:        { value: getItem },
		deleteItem:     { value: deleteItem },
		clearAll:       { value: clearAll },
		updateSettings: { value: updateSettings },
		funNuke:        { value: funNuke },
		ekuNnuf:        { value: ekuNnuf },
		importFromLocalStorage: { value: importFromLocalStorage },
	}));
})();
window.idb = idb;

/* eslint no-undef: "off", no-param-reassign: "off", no-alert: "off", no-fallthrough: "off", no-dupe-args: "warn", no-irregular-whitespace: "warn", max-len: "off", key-spacing: ["warn", {beforeColon: false, afterColon: true}], comma-dangle: ["warn", "always-multiline"], quotes: ["warn", "double"], indent: ["warn", "tab", {SwitchCase: 1}], id-length: "off", prefer-template: "off", brace-style: ["warn", "1tbs"] */
/**
 * hotkeys support for links and buttons
 */

const Links = (() => {
	"use strict";

	let currentLinks = [];
	let numberPrepend = "(";
	let numberAppend = ") ";
	let enabled = true;
	let disableNumbers = false;
	let disableRNGReload = false;
	let keyNumberMatcher;
	let maxKeyDescLength;
	let throttle = false;
	let shiftDown = false;
	let skipElements = ".no-numberify, .no-numberify *"; // here, we match class "no-numberify", and then also all it's children
	let includeElements = ""; // here, we can set up a matcher for exceptions that shouldn't be skipped

	function keyNumberMatcherUpdate() {
		keyNumberMatcher = new RegExp(RegExp.escape(numberPrepend) + "((Ctrl|Alt|Shift) \\+ )?\\d" + RegExp.escape(numberAppend));
		// limit the search to as little characters from the start of the line as possible to eliminate or at least reduce false-positives with custom append/prepend values
		maxKeyDescLength = numberAppend.length + numberPrepend.length + 9;
	}
	keyNumberMatcherUpdate();

	function getPrettyKeyNumber(counter) {
		let str = "";

		switch (Math.floor((counter - 1) / 10)) { // 10 should be counted as 0
			case 3: str = "Alt + "; break;
			case 2: str = "Ctrl + "; break;
			case 1: str = "Shift + "; break;
		}
		str += (counter % 10).toString();

		return str;
	}

	function generateLinkNumbers(content, visibility) {
		if (!enabled || disableNumbers || V.options && !V.options.numberify_enabled) return;

		// don't run this too often. ward off the worst outcomes of bad programming that would trigger massive <<replace>> spam
		const stamp = performance.now();
		if (throttle + 100 > stamp) {
			throttle = stamp;
			generateDebounce();
			return;
		}
		throttle = stamp;

		// find all visible .link-internal elements, then remove from them all skipElements unless they are also in includeElements
		if (visibility) {
			// using :hidden pseudo-class is preferred for telling actual visibility of the link, but it's not available at the passagerender time
			currentLinks = $(content).find(".link-internal").not(":hidden");
		} else {
			currentLinks = $(content).find(".link-internal").filter((i, link) => getComputedStyle(link).display !== "none");
		}
		if (skipElements && includeElements) {
			const goodies = $(content).find(includeElements);
			const baddies = $(content).find(skipElements).not(goodies);
			currentLinks = currentLinks.not(baddies);
		} else if (skipElements) {
			const baddies = $(content).find(skipElements);
			currentLinks = currentLinks.not(baddies);
		}

		for (let i = 0; i < Math.min(currentLinks.length, 40); i++) {
			const el = currentLinks[i];
			const keyNumber = numberPrepend + getPrettyKeyNumber(i + 1) + numberAppend;
			if (keyNumberMatcher.test(el.innerHTML.slice(0, maxKeyDescLength))) {
				// replace previously assigned number
				el.innerHTML = el.innerHTML.replace(keyNumberMatcher, keyNumber);
			} else {
				el.prepend(keyNumber);
			}
		}
		if (enabled === "debug") console.log(`Links: generated ${currentLinks.length} links, took ${performance.now() - stamp}ms"`);
	}

	// this is a mostly user-triggered function that is almost guaranteed to have the passage already rendered
	function generate() {
		return generateLinkNumbers(document.getElementsByClassName("passage")[0] || document, true);
	}

	// and this is our bouncer that we employ to prevent unwanted spam
	function generateDebounce() {
		return $.debounce(200, generate);
	}

	function linkFollow(index) {
		if (disableNumbers) return;
		if ($(currentLinks).length >= index) $(currentLinks[index - 1].click());
	}

	function inputFocused() {
		if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) && !["radio", "button", "checkbox", "submit", "reset", "image"].includes(document.activeElement.type)) return true;
		return false;
	}

	function init() {
		// collect all links and assign their numbers
		$(document).on(":passagerender", ev => {
			currentLinks = [];
			throttle = 0;
			generateLinkNumbers(ev.content);
		});

		// prevent numpad keys from triggering browser's default shortcuts
		$(document).on("keydown", ev => {
			if (ev.code.startsWith("Shift")) return shiftDown = true;
			if (inputFocused()) return;
			if (ev.code.startsWith("Numpad")) ev.preventDefault();
		});

		// assign shortcuts
		$(document).on("keyup", ev => {
			if (ev.code.startsWith("Shift")) return shiftDown = false;
			if (!enabled || V.tempDisable || V.options && !V.options.numberify_enabled || inputFocused()) return;
			if (Dialog.isOpen()) return ev.code === "Escape" ? Dialog.close() : false;

			let offset = 0;
			if (ev.shiftKey) offset = 10;
			else if (ev.code.startsWith("Numpad") && shiftDown) offset = 10; // windows must die
			else if (ev.ctrlKey) offset = 20;
			else if (ev.altKey) offset = 30;

			switch (ev.code) {
				case "Digit1": case "Numpad1": case "KeyN":
					linkFollow(offset + 1);
					break;
				case "Digit2": case "Numpad2":
					linkFollow(offset + 2);
					break;
				case "Digit3": case "Numpad3":
					linkFollow(offset + 3);
					break;
				case "Digit4": case "Numpad4":
					linkFollow(offset + 4);
					break;
				case "Digit5": case "Numpad5":
					linkFollow(offset + 5);
					break;
				case "Digit6": case "Numpad6":
					linkFollow(offset + 6);
					break;
				case "Digit7": case "Numpad7":
					linkFollow(offset + 7);
					break;
				case "Digit8": case "Numpad8":
					linkFollow(offset + 8);
					break;
				case "Digit9": case "Numpad9":
					linkFollow(offset + 9);
					break;
				case "Digit0": case "Numpad0":
					linkFollow(offset + 10);
					break;
				case "NumpadDivide":
					// go back in history, twice if shift is pressed
					if (ev.shiftKey) Engine.go(-2);
					else Engine.backward();
					break;
				case "NumpadMultiply":
					// reload current page with different rng
					if (disableRNGReload) break; // let game devs disable potentially cheaty option
					State.restore(true);
					// State.unmarshalForSave(State.marshalForSave()); // save and immediately reload current state
					if (State.prng.isEnabled()) { // hack for predictable rng
						State.random(); // update rng pool
						const frame = State.history[State.activeIndex]; // active history frame
						frame.pull = State.prng.pull; // update pull
					}
					Engine.show();
					break;
				case "NumpadSubtract":
					// go forward in history
					if (ev.shiftKey) Engine.go(2);
					else Engine.forward();
					break;
			}
		});
	}

	return Object.freeze(Object.defineProperties({}, {
		init: { value: init },
		generate: { value: generate },
		generateLinkNumbers: { value: generateLinkNumbers },
		pushTheButton:       { value: linkFollow },
		numberPrepend:       { get() { return numberPrepend;    }, set(val) { numberPrepend = val; keyNumberMatcherUpdate(); } },
		numberAppend:        { get() { return numberAppend;     }, set(val) { numberAppend = val; keyNumberMatcherUpdate(); } },
		skipElements:        { get() { return skipElements;     }, set(val) { skipElements = val; } },
		includeElements:     { get() { return includeElements;  }, set(val) { includeElements = val; } },
		enabled:             { get() { return enabled;          }, set(val) { enabled = val; } },
		disableRNGReload:    { get() { return disableRNGReload; }, set(val) { disableRNGReload = val; } },
		disableNumbers:      { get() { return disableNumbers;   }, set(val) { disableNumbers = val; } },
		throttle:            { get() { return throttle;         }, set(val) { throttle = val; } },
		currentLinks:        { get() { return currentLinks;     } },
	}));
})();
window.Links = Links;

/***********************************************************************************************************************

	sugarcube.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/*
	global Alert, Browser, Config, Dialog, Engine, Fullscreen, Has, LoadScreen, SimpleStore, L10n, Macro, Passage,
	       Save, Scripting, Setting, SimpleAudio, State, Story, UI, UIBar, DebugBar, Util, Visibility, Wikifier
	, Links, idb
*/
/* eslint-disable no-var */

/*
	Version object.
*/
var version = Object.freeze({
	title      : 'SugarCube',
	major      : 2,
	minor      : 36,
	patch      : 1,
	prerelease : null,
	build      : 939,
	date       : new Date("2024-12-09T23:24:19.950Z"),
	/* legacy */
	extensions : {},
	/* /legacy */

	toString() {
		'use strict';

		const prerelease = this.prerelease ? `-${this.prerelease}` : '';
		return `${this.major}.${this.minor}.${this.patch}${prerelease}+${this.build}`;
	},

	short() {
		'use strict';

		const prerelease = this.prerelease ? `-${this.prerelease}` : '';
		return `${this.title} (v${this.major}.${this.minor}.${this.patch}${prerelease})`;
	},

	long() {
		'use strict';

		return `${this.title} v${this.toString()} (${this.date.toUTCString()})`;
	}
});

/* eslint-disable no-unused-vars */
/*
	Internal variables.
*/
// Temporary state object.
var TempState = {};

// Legacy macros object.
var macros = {};

// Post-display task callbacks object.
var postdisplay = {};

// Post-render task callbacks object.
var postrender = {};

// Pre-display task callbacks object.
var predisplay = {};

// Pre-history task callbacks object.
var prehistory = {};

// Pre-render task callbacks object.
var prerender = {};

// Session storage manager object.
var session = null;

// Settings object.
var settings = {};

// Setup object.
var setup = {};

// Persistant storage manager object.
var storage = null;

/*
	Legacy aliases.
*/
var browser       = Browser;
var config        = Config;
var has           = Has;
var History       = State;
var state         = State;
var tale          = Story;
var TempVariables = State.temporary;
/* eslint-enable no-unused-vars */

/*
	Global `SugarCube` object.  Allows scripts to detect if they're running in SugarCube by
	testing for the object (e.g. `"SugarCube" in window`) and contains exported identifiers
	for debugging purposes.
*/
window.SugarCube = {};

/*
	Main function, entry point for the story.
*/
jQuery(() => {
	'use strict';

	if (DEBUG) { console.log('[SugarCube/main()] Document loaded; beginning startup.'); }

	/*
		WARNING!

		The ordering of the code within this function is critically important,
		so be careful when mucking around with it.
	*/
	try {
		// Acquire an initial lock for and initialize the loading screen.
		const lockId = LoadScreen.lock();
		LoadScreen.init();

		// Normalize the document.
		if (document.normalize) {
			document.normalize();
		}

		// Load the story data (must be done before most anything else).
		Story.load();

		// Instantiate the storage and session objects.
		// NOTE: `SimpleStore.create(storageId, persistent)`
		storage = SimpleStore.create(Story.domId, true);
		session = SimpleStore.create(Story.domId, false);

		// Initialize the user interface (must be done before story initialization, specifically before scripts).
		Dialog.init();
		UIBar.init();
		Engine.init();

		// Initialize the story (largely load the user styles, scripts, and widgets).
		Story.init();

		// Initialize the localization (must be done after story initialization).
		L10n.init();

		// Alert when the browser is degrading required capabilities (must be done after localization initialization).
		if (!session.has('rcWarn') && storage.name === 'cookie') {
			/* eslint-disable no-alert */
			session.set('rcWarn', 1);
			window.alert(L10n.get('warningNoWebStorage'));
			/* eslint-enable no-alert */
		}

		// Initialize the saves (must be done after story initialization, but before engine start).
		Save.init();

		// Initialize the settings.
		Setting.init();

		// Initialize indexedDB
		idb.init(Story.domId);

		// Initialize hotkeys
		Links.init();

		// Initialize the macros.
		Macro.init();

		// Start the engine (should be done as late as possible, but before interface startup).
		Engine.start();

		// Initialize the debug bar interface (should be done as late as possible, but before interface startup).
		if (Config.debug) {
			DebugBar.init();
		}

		// Set a recurring timer to start the interfaces (necessary due to DOM readiness issues in some browsers).
		const $window    = $(window);
		const vprCheckId = setInterval(() => {
			// If `$window.width()` returns a zero value, bail out and wait.
			if (!$window.width()) {
				return;
			}

			// Clear the recurring timer.
			clearInterval(vprCheckId);

			// Start the UI bar interface.
			UIBar.start();

			// Start the debug bar interface.
			if (Config.debug) {
				DebugBar.start();
			}

			// Trigger the `:storyready` global synthetic event.
			jQuery.event.trigger({ type : ':storyready' });

			// Release the loading screen lock after a short delay.
			setTimeout(() => LoadScreen.unlock(lockId), Engine.minDomActionDelay * 2);
		}, Engine.minDomActionDelay);

		// Finally, export identifiers for debugging purposes.
		Object.defineProperty(window, 'SugarCube', {
			// WARNING: We need to assign new values at points, so seal it, do not freeze it.
			value : Object.seal(Object.assign(Object.create(null), {
				Browser,
				Config,
				Dialog,
				Engine,
				Fullscreen,
				Has,
				L10n,
				Macro,
				Passage,
				Save,
				Scripting,
				Setting,
				SimpleAudio,
				State,
				Story,
				UI,
				UIBar,
				DebugBar,
				Util,
				Visibility,
				Wikifier,
				session,
				settings,
				setup,
				storage,
				version
			}))
		});

		if (DEBUG) { console.log('[SugarCube/main()] Startup complete; story ready.'); }
	}
	catch (ex) {
		console.error(ex);
		LoadScreen.clear();
		return Alert.fatal(null, ex.message, ex);
	}
});

})(window, window.document, jQuery);
}
	