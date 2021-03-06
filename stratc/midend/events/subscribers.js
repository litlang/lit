//takes every dispatch, turns it into a function
//adds the subscribers property to the AST

const { traverse, val } = require('../../ast');

module.exports = deps => ast => {
  const allDispatchesWithContainerName = traverse(ast, ['file', 'service|source'])
    .flatmap(container => {
      const name = val(container, 'name');
      return traverse(container, ['body', 'dispatch'])
        .map(dispatch => [dispatch, name]);
    });

  const subscribers = allDispatchesWithContainerName
    .flatmap(dispatchTuple => {
      const dispatch = dispatchTuple[0];
      const dispatchName = val(traverse(dispatch, ['functionName'])[0], 'name');
      const reference = `${dispatchTuple[1]}.${dispatchName}`;
      return dispatch.event.map(event => [event, reference]);
    })
    .reduce((subscribers, nextEventTuple) => {
      const event = nextEventTuple[0];
      const reference = nextEventTuple[1];
      const eventName = val(event, 'name');
      const pattern = (event.pattern|| [])[0];
      const subConfig = {
        pattern: reducePattern(pattern),
        reference: reference
      };

      if (subscribers[eventName] === undefined) {
        subscribers[eventName] = [];
      }
      subscribers[eventName].push(subConfig);
      return subscribers;
    }, {});
  ast.subscribers = subscribers;

  mergeDispatchesIntoFunctions(ast);
  return ast;
};

function mergeDispatchesIntoFunctions (ast) {
  const containers = traverse(ast, ['file', 'source|service']);

  containers.forEach(container => {
    const dispatches = traverse(container, ['body', 'dispatch']);

    dispatches.forEach(dispatch => {
      dispatch.type = 'function';
      delete dispatch.event;
    });

    var functions = traverse(container, ['body', 'function']) || [];

    functions = functions.concat(dispatches);

    container.body[0].dispatch = [];
    container.body[0].function = functions;
  });
}

function reducePattern (patternAst) {
  if (patternAst === undefined) {
    return 'any';
  }
  const type = val(patternAst, 'type');
  switch(type) {
    case 'string':
    case 'number':
    case 'true':
    case 'false':
    case 'null':
      return val(patternAst, 'value');
    case 'array':
      return [ (patternAst.shape || []).map(shape => val(shape, 'name'))[0] ]
        .purge();
    case 'map':
      return (patternAst.pattern || [])
        .map(reducePattern)
        .toMap(kvp => kvp[1], kvp => kvp[0]);
    case 'kvp':
      return [val(patternAst, 'key'), reducePattern(patternAst.pattern[0])];
  }
}
