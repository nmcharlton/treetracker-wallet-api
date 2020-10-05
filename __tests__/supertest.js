/*
 * The integration test to test the whole business, with DB
 */

const request = require('supertest');
const assert = require ('assert');
const server = require("../server/app");
const { expect } = require('chai');
const seed = require('./seed');
const log = require('loglevel');

const mockUser = {
  wallet: seed.wallet.name,
  password: seed.wallet.password,
};

const newWallet = {
  name: 'MyFriendsNewWallet',
};

const apiKey = seed.apiKey;

describe('Route integration', () => {
  let token;

  beforeEach(async () => {
    //before all, seed data to DB
    await seed.clear();
    await seed.seed();

    // Authorizes before each of the follow tests
    const res = await request(server)
      .post('/auth')
      .set('treetracker-api-key', apiKey)
      .send(mockUser);
    expect(res).to.have.property('statusCode', 200);
    token = res.body.token;
    expect(token).to.match(/\S+/);
  });

  afterEach(done => {
    //after finished all the test, clear data from DB
    seed.clear()
      .then(() => {
        done();
      });
  });

  // Authorization path
  it(`[POST /auth] login with wallet:${seed.wallet.name}`, (done) => {
    request(server)
      .post('/auth')
      .set('treetracker-api-key', apiKey)
      .send(mockUser)
      .expect('Content-Type', /application\/json/)
      .expect(200)
      .end((err, res) => {
        if (err) done(err);
        expect(res.body).to.have.property('token');
        done();
      });
  });

  // Tests that require logged-in authorization

  it(`[GET /token/${seed.token.uuid}] Should be able to get a token `, async () => {
    const res = await request(server)
      .get(`/token/${seed.token.uuid}`)
      .set('treetracker-api-key', apiKey)
      .set('Authorization', `Bearer ${token}`);
    expect(res).to.have.property('statusCode', 200);
    expect(res.body).to.have.property('token').eq(seed.token.uuid);
  });

  describe(`Before request trust, try to send token from wallet:${seed.wallet.name} to walletB:${seed.walletB.name} should get 202`, () => {

    beforeEach(async () => {
      const res = await request(server)
        .post("/transfers")
        .set('treetracker-api-key', apiKey)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sender_wallet: seed.wallet.name,
          receiver_wallet: seed.walletB.name,
        });
      expect(res).property("statusCode").to.eq(202);
    })

    describe(`wallet:${seed.wallet.name} request trust relationship with walletB:${seed.walletB.name} & with type: send`, () => {
      let trustRelationship;

      beforeEach(async () => {
        const res = await request(server)
          .post("/trust_relationships")
          .set('treetracker-api-key', apiKey)
          .set('Authorization', `Bearer ${token}`)
          .send({
            trust_request_type: 'send',
            wallet: seed.walletB.name,
          });
        expect(res).property("statusCode").to.eq(200);
        trustRelationship = res.body;
        expect(trustRelationship).property("id").a("number");
      });

      describe("Login with walletB", () => {
        let tokenB;

        beforeEach(async () => {
          const res = await request(server)
            .post('/auth')
            .set('treetracker-api-key', apiKey)
            .send({
              wallet: seed.walletB.name,
              password: seed.walletB.password,
            });
          expect(res).to.have.property('statusCode', 200);
          tokenB = res.body.token;
        })

        describe("Accept this request", () => {

          beforeEach(async () => {
            const res = await request(server)
              .post(`/trust_relationships/${trustRelationship.id}/accept`)
              .set('treetracker-api-key', apiKey)
              .set('Authorization', `Bearer ${tokenB}`);
            expect(res).property("statusCode").to.eq(200);
          })

          it("Wallet should be able to find the relationship, and it was approved", async () => {
            const res = await request(server)
              .get("/trust_relationships")
              .set('treetracker-api-key', apiKey)
              .set('Authorization', `Bearer ${token}`);
            expect(res).property("statusCode").to.eq(200);
            expect(res).property("body").property("trust_relationships").lengthOf(1);
            expect(res.body.trust_relationships[0]).property("id").a("number");
          });

          it("Try to send a token to walletB again, this time, shouldn't throw 403", async () => {
            const res = await request(server)
              .post("/transfers")
              .set('treetracker-api-key', apiKey)
              .set('Authorization', `Bearer ${token}`)
              .send({
                sender_wallet: seed.wallet.name,
                receiver_wallet: seed.walletB.name,
              });
            expect(res).property("statusCode").to.eq(200);
          });
        });
      });
    });
  });


  describe("Relationship", () => {

    beforeEach(async () => {
      const res = await request(server)
        .post("/trust_relationships")
        .set('treetracker-api-key', apiKey)
        .set('Authorization', `Bearer ${token}`)
        .send({
          trust_request_type: 'send',
          wallet: seed.wallet.name,
        });
      expect(res).property("statusCode").to.eq(200);
    });
    it("GET /trust_relationships", async () => {
      const res = await request(server)
        .get("/trust_relationships")
        .set('treetracker-api-key', apiKey)
        .set('Authorization', `Bearer ${token}`);
      expect(res).property("statusCode").to.eq(200);
      log.debug(res);
      expect(res).property("body").property("trust_relationships").lengthOf(1);
      expect(res.body.trust_relationships[0]).property("id").a("number");
    });

    describe("Request trust relationship", () => {
      it("POST /trust_relationships with wrong request type", async () => {
        const res = await request(server)
          .post("/trust_relationships")
          .set('treetracker-api-key', apiKey)
          .set('Authorization', `Bearer ${token}`)
          .send({
            trust_request_type: 'wrongtype',
            wallet: 'any',
          });
        expect(res).property("statusCode").to.eq(400);
      });

      it("POST /trust_relationships", async () => {
        const res = await request(server)
          .post("/trust_relationships")
          .set('treetracker-api-key', apiKey)
          .set('Authorization', `Bearer ${token}`)
          .send({
            trust_request_type: 'send',
            wallet: seed.wallet.name,
          });
        expect(res).property("statusCode").to.eq(200);
      });
    });
  });

});

/* __________________________OLD TESTS FOR PREVIOUS API VERSION___________________________

  xdescribe(`[POST /transfer] Now transfer wallet:${seed.wallet.name}'s token to the new wallet`, () => {

    beforeEach(async () => {
      const res = await request(server)
        .post('/transfer')
        .set('treetracker-api-key', apiKey)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tokens: [seed.token.uuid],
          sender_wallet: seed.wallet.name,
          receiver_wallet: newWallet.name,
        });
      expect(res)
        .to.have.property('statusCode', 200);
    });

    xit('[GET /history] Should be able to find a record about this token in the history API', async () => {
      const res = await request(server)
        .get(`/history?token=${seed.token.uuid}`)
        .set('treetracker-api-key', apiKey)
        .set('Authorization', `Bearer ${token}`);
      expect(res)
        .to.have.property('statusCode', 200);
      expect(res.body)
        .to.have.property('history')
        .to.have.lengthOf(1);
      expect(res.body.history[0])
        .to.have.property('token', seed.token.uuid);
      expect(res.body.history[0])
        .to.have.property('sender_wallet', seed.wallet.name);
      expect(res.body.history[0])
        .to.have.property('receiver_wallet', newWallet.name);
    });

  });

  describe(`[POST /send] Now transfer wallet:${seed.wallet.name}'s token to the new wallet`, () => {

    beforeEach(async () => {
      const res = await request(server)
        .post('/send')
        .set('treetracker-api-key', apiKey)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tokens: [seed.token.uuid],
          receiver_wallet: newWallet.name,
        });
      expect(res)
        .to.have.property('statusCode', 200);
    });

    xit('[GET /history] Should be able to find a record about this token in the history API', async () => {
      const res = await request(server)
        .get(`/history?token=${seed.token.uuid}`)
        .set('treetracker-api-key', apiKey)
        .set('Authorization', `Bearer ${token}`);
      expect(res)
        .to.have.property('statusCode', 200);
      expect(res.body)
        .to.have.property('history')
        .to.have.lengthOf(1);
      expect(res.body.history[0])
        .to.have.property('token', seed.token.uuid);
      expect(res.body.history[0])
        .to.have.property('sender_wallet', seed.wallet.name);
      expect(res.body.history[0])
        .to.have.property('receiver_wallet', newWallet.name);
    });

  });

});

  // Get trees in user's wallet
  describe('[GET /tree] gets trees from logged in user wallet', () => {

    xit(`Should have 1 tree under the wallet:${seed.entity.wallet}`, (done) => {
      request(server)
        .get('/tree')
        .set('treetracker-api-key', apiKey)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .end((err, res) => {
          if (err) done(err);
          expect(res.body).to.have.property('trees');
          expect(res.body.trees).to.be.an('array');
          //should have a tree now
          expect(res.body.trees).to.have.lengthOf(1);
          expect(res.body).to.have.property('wallet');
          expect(res.body).to.have.property('wallet_url');
          done();
        });
    });
  });

  // Get details of logged in account
  xit(`[GET /wallet] get account should find the current wallet ${seed.wallet.name}`, async () => {
    expect(token)
      .to.match(/\S+/);
    let response = await request(server)
      .get('/account')
      .set('treetracker-api-key', apiKey)
      .set('Authorization', `Bearer ${token}`);
    expect(response)
      .to.have.property('statusCode')
      .to.equal(200);
    expect(response.body).to.have.property('accounts');
    expect(response.body.accounts).to.be.an('array');
    expect(response.body)
      .to.have.property('accounts')
      .that.have.property(0)
      .that.to.have.property('wallet', seed.wallet.name);
  });

  describe(`[POST /wallet] Create subWallet '${newWallet.name}`, () => {

    beforeEach(async () => {
      const res = await request(server)
        .post('/wallets')
        .set('treetracker-api-key', apiKey)
        .set('Authorization', `Bearer ${token}`)
        .send({
          wallet: newWallet.name,
        });
      expect(res)
        .to.have.property('statusCode', 200);
    });



    xit('[GET /wallets] Should find two accounts now', async () => {
      const res = await request(server)
        .get('/account')
        .set('treetracker-api-key', apiKey)
        .set('Authorization', `Bearer ${token}`);
      expect(res)
        .to.have.property('statusCode', 200);
      expect(res)
        .to.have.property('body')
        .to.have.property('accounts')
        .that.to.have.lengthOf(2);
      expect(res.body.accounts[1])
        .to.have.property('wallet', subWallet.name);
    });






    describe(`[POST /transfer/bundle] Now bundle transfer wallet:${seed.entity.wallet}'s token to the new wallet`, () => {

      beforeEach(async () => {
        const res = await request(server)
          .post('/transfer/bundle')
          .set('treetracker-api-key', apiKey)
          .set('Authorization', `Bearer ${token}`)
          .send({
            bundle_size: 1,
            sender_wallet: seed.entity.wallet,
            receiver_wallet: subWallet.name,
          });
        expect(res)
          .to.have.property('statusCode', 200);
      });

      xit('[GET /history] Should be able to find a record about this token in the history API', async () => {
        const res = await request(server)
          .get(`/history?token=${seed.token.uuid}`)
          .set('treetracker-api-key', apiKey)
          .set('Authorization', `Bearer ${token}`);
        expect(res)
          .to.have.property('statusCode', 200);
        expect(res.body)
          .to.have.property('history')
          .to.have.lengthOf(1);
        expect(res.body.history[0])
          .to.have.property('token', seed.token.uuid);
        expect(res.body.history[0])
          .to.have.property('sender_wallet', seed.entity.wallet);
        expect(res.body.history[0])
          .to.have.property('receiver_wallet', subWallet.name);
      });

    });

*/

