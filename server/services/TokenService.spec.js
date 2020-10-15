const TokenService = require("./TokenService");
const jestExpect = require("expect");
const sinon = require("sinon");
const TokenRepository = require("../repositories/TokenRepository");
const HttpError = require("../utils/HttpError");

describe("Token", () => {
  let tokenService;

  beforeEach(() => {
    tokenService = new TokenService();
  })

  it("getByUUID() with id which doesn't exist, should throw 404", async () => {
    sinon.stub(TokenRepository.prototype, "getByUUID").rejects(new HttpError(404, "not found"));
    await jestExpect(async () => {
      await tokenService.getByUUID("testUuid");
    }).rejects.toThrow('not found');
    TokenRepository.prototype.getByUUID.restore();
  });

});