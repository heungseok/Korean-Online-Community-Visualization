var FlyControls = require('three.fly');
var eventify = require('ngraph.events');
var THREE = require('three');
var createHitTest = require('./hitTest.js');

module.exports = createInput;

function createInput(camera, graph, domElement) {
  var controls = new FlyControls(camera, domElement, THREE);
  var hitTest = createHitTest(domElement);
  // todo: this should all be based on graph size/options:
  var totalNodes = graph.getNodesCount();
  controls.movementSpeed =  Math.max(totalNodes * 0.1, 200);
  controls.rollSpeed = 0.20;

  var keyMap = Object.create(null);
  var api = {
    update: update,
    onKey: onKey,
    reset: reset,
    adjustSpeed: adjustSpeed
  };

  eventify(api);

  hitTest.on('nodeover', passthrough('nodeover'));
  hitTest.on('nodeclick', passthrough('nodeclick'));
  hitTest.on('nodedblclick', passthrough('nodedblclick'));

  controls.on('move', inputChanged);

  // lock the duplicated keyboard & mouse input(now is the trackball controller- see the index.js, graph_construction.js)
  // domElement.addEventListener('keydown', globalKeyHandler, false);

  //  얘를 열어줘야 노드 호버링이 globally 작동.
  domElement.addEventListener('mousemove', globalMouseMove, false);

  return api;

  function adjustSpeed(sceneRadius) {
    controls.movementSpeed = sceneRadius * 0.1;
  }

  function update() {
    controls.update(0.1);
  }

  function passthrough(name) {
    return function(e) {
      api.fire(name, e);
    };
  }

  function inputChanged(moveArg) {
    api.fire('move', moveArg);
    updateHitTest();
  }

  function onKey(keyName, handler) {
    keyMap[keyName] = handler;
  }

  function globalKeyHandler(e) {
    var handler = keyMap[e.which];
    if (typeof handler === 'function') {
      handler(e);
    }
  }

  function globalMouseMove() {
    updateHitTest();
  }

  function updateHitTest() {
    var scene = camera.parent;
    hitTest.update(scene, camera);
  }

  function reset() {
    hitTest.reset();
  }
}
