const path = require('path');
const compiler = require('../../compile')();
const assert = require('assert');
const hosts = fileData => compiler(
  null,
  'hosts',
  fileData,
  path.resolve(__dirname, './fileInput.st'));
const { traverse } = require('../../../../stratc/ast');

const emptyService = `
service X {}
`;

const emptySource = `
source X {}
`;

const externSource = `
source X {
  include "Extern"
  Extern -> foo ():any -> "foo"
}
service Y {}
`;

const httpService = `
service X {
  include "Http"
  Http -> foo ():any -> "foo"
}
`;

const complexTwoServices = `
service foo {
  include "Http"
  include "Extern"
  Extern -> bleh ():any -> "foo.js"

  Http -> "foo"

  blah ():any -> "foo.js"
}

service Other {
  include "Birth"
  Birth -> foo.blah
  baz ():any -> "x"
}`;

describe('hosts', () => {
  it('creates a single X host', async () => {
    const result = await hosts(emptySource);
    assert(result.hosts.keys().length === 1);
    assert(result.hosts['X'] !== undefined);
  });
  it('should not have a host for included Extern', async () => {
    const result = await hosts(externSource);
    assert(result.hosts.keys().length === 1);
    assert(result.hosts['X'] !== undefined);
  });
  it('should have a host for included Http', async () => {
    const result = await hosts(httpService);
    assert(result.hosts.keys().length === 2);
    assert(result.hosts.Http !== undefined);
  });
  it('should not include Xs functions inside Https host', async () => {
    const result = await hosts(httpService);
    const servicesWithFunctionsOnThisHost = result.hosts.Http.artifacts
      .filter(a => a.name.indexOf('reflect') === -1)
      .toMap(v => true, k => k.name.split('.')[0]);
    assert(result.hosts.Http.containers.X === undefined);
    assert(servicesWithFunctionsOnThisHost['X'] === undefined);
  });
  it('should keep other in scope for foo', async () => {
    const result = await hosts(complexTwoServices);
    assert.deepStrictEqual(result.hosts.foo.inScope,
      {foo: true, Other: true});
  });
});
