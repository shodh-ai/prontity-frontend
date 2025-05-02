"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/is-stream";
exports.ids = ["vendor-chunks/is-stream"];
exports.modules = {

/***/ "(ssr)/./node_modules/is-stream/index.js":
/*!*****************************************!*\
  !*** ./node_modules/is-stream/index.js ***!
  \*****************************************/
/***/ ((module) => {

eval("\nconst isStream = (stream)=>stream !== null && typeof stream === \"object\" && typeof stream.pipe === \"function\";\nisStream.writable = (stream)=>isStream(stream) && stream.writable !== false && typeof stream._write === \"function\" && typeof stream._writableState === \"object\";\nisStream.readable = (stream)=>isStream(stream) && stream.readable !== false && typeof stream._read === \"function\" && typeof stream._readableState === \"object\";\nisStream.duplex = (stream)=>isStream.writable(stream) && isStream.readable(stream);\nisStream.transform = (stream)=>isStream.duplex(stream) && typeof stream._transform === \"function\";\nmodule.exports = isStream;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvaXMtc3RyZWFtL2luZGV4LmpzIiwibWFwcGluZ3MiOiJBQUFBO0FBRUEsTUFBTUEsV0FBV0MsQ0FBQUEsU0FDaEJBLFdBQVcsUUFDWCxPQUFPQSxXQUFXLFlBQ2xCLE9BQU9BLE9BQU9DLElBQUksS0FBSztBQUV4QkYsU0FBU0csUUFBUSxHQUFHRixDQUFBQSxTQUNuQkQsU0FBU0MsV0FDVEEsT0FBT0UsUUFBUSxLQUFLLFNBQ3BCLE9BQU9GLE9BQU9HLE1BQU0sS0FBSyxjQUN6QixPQUFPSCxPQUFPSSxjQUFjLEtBQUs7QUFFbENMLFNBQVNNLFFBQVEsR0FBR0wsQ0FBQUEsU0FDbkJELFNBQVNDLFdBQ1RBLE9BQU9LLFFBQVEsS0FBSyxTQUNwQixPQUFPTCxPQUFPTSxLQUFLLEtBQUssY0FDeEIsT0FBT04sT0FBT08sY0FBYyxLQUFLO0FBRWxDUixTQUFTUyxNQUFNLEdBQUdSLENBQUFBLFNBQ2pCRCxTQUFTRyxRQUFRLENBQUNGLFdBQ2xCRCxTQUFTTSxRQUFRLENBQUNMO0FBRW5CRCxTQUFTVSxTQUFTLEdBQUdULENBQUFBLFNBQ3BCRCxTQUFTUyxNQUFNLENBQUNSLFdBQ2hCLE9BQU9BLE9BQU9VLFVBQVUsS0FBSztBQUU5QkMsT0FBT0MsT0FBTyxHQUFHYiIsInNvdXJjZXMiOlsid2VicGFjazovL2FuaW1hLXByb2plY3QvLi9ub2RlX21vZHVsZXMvaXMtc3RyZWFtL2luZGV4LmpzPzE5ZDgiXSwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBpc1N0cmVhbSA9IHN0cmVhbSA9PlxuXHRzdHJlYW0gIT09IG51bGwgJiZcblx0dHlwZW9mIHN0cmVhbSA9PT0gJ29iamVjdCcgJiZcblx0dHlwZW9mIHN0cmVhbS5waXBlID09PSAnZnVuY3Rpb24nO1xuXG5pc1N0cmVhbS53cml0YWJsZSA9IHN0cmVhbSA9PlxuXHRpc1N0cmVhbShzdHJlYW0pICYmXG5cdHN0cmVhbS53cml0YWJsZSAhPT0gZmFsc2UgJiZcblx0dHlwZW9mIHN0cmVhbS5fd3JpdGUgPT09ICdmdW5jdGlvbicgJiZcblx0dHlwZW9mIHN0cmVhbS5fd3JpdGFibGVTdGF0ZSA9PT0gJ29iamVjdCc7XG5cbmlzU3RyZWFtLnJlYWRhYmxlID0gc3RyZWFtID0+XG5cdGlzU3RyZWFtKHN0cmVhbSkgJiZcblx0c3RyZWFtLnJlYWRhYmxlICE9PSBmYWxzZSAmJlxuXHR0eXBlb2Ygc3RyZWFtLl9yZWFkID09PSAnZnVuY3Rpb24nICYmXG5cdHR5cGVvZiBzdHJlYW0uX3JlYWRhYmxlU3RhdGUgPT09ICdvYmplY3QnO1xuXG5pc1N0cmVhbS5kdXBsZXggPSBzdHJlYW0gPT5cblx0aXNTdHJlYW0ud3JpdGFibGUoc3RyZWFtKSAmJlxuXHRpc1N0cmVhbS5yZWFkYWJsZShzdHJlYW0pO1xuXG5pc1N0cmVhbS50cmFuc2Zvcm0gPSBzdHJlYW0gPT5cblx0aXNTdHJlYW0uZHVwbGV4KHN0cmVhbSkgJiZcblx0dHlwZW9mIHN0cmVhbS5fdHJhbnNmb3JtID09PSAnZnVuY3Rpb24nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzU3RyZWFtO1xuIl0sIm5hbWVzIjpbImlzU3RyZWFtIiwic3RyZWFtIiwicGlwZSIsIndyaXRhYmxlIiwiX3dyaXRlIiwiX3dyaXRhYmxlU3RhdGUiLCJyZWFkYWJsZSIsIl9yZWFkIiwiX3JlYWRhYmxlU3RhdGUiLCJkdXBsZXgiLCJ0cmFuc2Zvcm0iLCJfdHJhbnNmb3JtIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/is-stream/index.js\n");

/***/ })

};
;