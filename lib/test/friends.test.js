const mongoose = require('mongoose');
const friends = require('../index.js');
const assert = require('assert');

mongoose.connect("mongodb://localhost:27017");

let UserSchema = new mongoose.Schema({
    name: String
});

UserSchema.plugin(friends);

const User = mongoose.model('User', UserSchema);

async function ensureUsers() {
    await new User({ name: 'John' }).save();
    await new User({ name: 'Jane' }).save();
    await new User({ name: 'Jack' }).save();
    await new User({ name: 'Jill' }).save();
    return;
}

async function clearUsers() {
    await User.deleteMany({})
    return;
}

describe("Methods", async () => {
    beforeEach(ensureUsers);
    afterEach(clearUsers)
    it("should add a relationship", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.addRelation(user2, "requested")
        await user2.addRelation(user1, "pending")
        user1.save();
        user2.save();
        assert.equal(user1.relations[0].status, "requested")
        assert.equal(user2.relations[0].status, "pending")
    })
    it("should fetch a relationship", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.addRelation(user2, "requested")
        await user2.addRelation(user1, "pending")
        user1.save();
        user2.save();
        let user1Relation = await user1.getRelation(user2)
        let user2Relation = await user2.getRelation(user1._id)
        assert.equal(user1Relation.status, "requested")
        assert.equal(user2Relation.status, "pending")
    })
    it("should fetch all relations", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.addRelation(user2, "requested")
        await user2.addRelation(user1, "pending")
        user1.save();
        user2.save();
        let relations = user1.getRelations(user2)
        assert.equal(relations[0].status, "requested")
    });
    it("should be able to send a friend request", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        let user1Relation = await user1.getRelation(user2)
        let user2Relation = await user2.getRelation(user1)
        assert.equal(user1Relation.status, "requested")
        assert.equal(user2Relation.status, "pending")
    });
    it("should be able to accept a friend request", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        let relation = await user2.acceptFriend(user1)
        assert.equal(relation.status, "accepted")
        let user1Relation = await user1.getRelation(user2)
        let user2Relation = await user2.getRelation(user1)
        assert.equal(user1Relation.status, "accepted")
        assert.equal(user2Relation.status, "accepted")
    });
    it("should be able to deny a friend request", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        await user2.denyFriend(user1)
        let user1Relation = await user1.getRelation(user2)
        let user2Relation = await user2.getRelation(user1)
        assert.equal(user1Relation, null)
        assert.equal(user2Relation, null)
    });
    it("should be able to block a friend", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        await user2.blockUser(user1)
        let user1Relation = await user1.getRelation(user2)
        let user2Relation = await user2.getRelation(user1)
        assert.equal(user1Relation.status, "blocked")
        assert.equal(user2Relation.status, "blocked")
    });
    it("should be able to block a stranger", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user2.blockUser(user1)
        let user1Relation = await user1.getRelation(user2)
        let user2Relation = await user2.getRelation(user1)
        assert.equal(user1Relation.status, "blocked")
        assert.equal(user2Relation.status, "blocked")
    });
    it("should be able to unblock", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        await user2.blockUser(user1)
        await user2.unblockUser(user1)
        await user1.requestFriend(user2)
        let user1Relation = await user1.getRelation(user2)
        let user2Relation = await user2.getRelation(user1)
        assert.equal(user1Relation.status, "requested")
        assert.equal(user2Relation.status, "pending")
    });
    it("should be able to retrieve incoming requests", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user2.requestFriend(user1)
        const pending = await user1.getPending();
        assert.equal(pending.length, 1)
    });
    it("should be able to retrieve outgoing requests", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        const requested = await user1.getRequested()
        assert.equal(requested.length, 1)
    });
    it("should be able to retrieve list of friends", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        await user2.acceptFriend(user1)
        const friends = await user1.getFriends()
        assert.equal(friends.length, 1)
    });
    it("should be able to retrieve list of blocked users", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        await user2.blockUser(user1)
        const blocked = await user1.getBlocked();
        assert.equal(blocked.length, 1)
    });
});