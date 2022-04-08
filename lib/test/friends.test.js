import mongoose from "mongoose";
import friends from "../index.js";
import * as assert from 'assert';

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
        let user1Relation = user1.getRelation(user2)
        let user2Relation = user2.getRelation(user1._id)
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
        assert.equal(user1.getRelation(user2).status, "requested")
        assert.equal(user2.getRelation(user1).status, "pending")
    });
    it("should be able to accept a friend request", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        await user2.acceptFriend(user1)
        assert.equal(user1.getRelation(user2).status, "accepted")
        assert.equal(user2.getRelation(user1).status, "accepted")
    });
    it("should be able to deny a friend request", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        await user2.denyFriend(user1)
        assert.equal(user1.getRelation(user2), null)
        assert.equal(user2.getRelation(user1), null)
    });
    it("should be able to block a friend", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        await user2.blockUser(user1)
        assert.equal(user1.getRelation(user2).status, "blocked")
        assert.equal(user2.getRelation(user1).status, "blocked")
    });
    it("should be able to block a stranger", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user2.blockUser(user1)
        assert.equal(user1.getRelation(user2).status, "blocked")
        assert.equal(user2.getRelation(user1).status, "blocked")
    });
    it("should be able to unblock", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        await user2.blockUser(user1)
        await user2.unblockUser(user1)
        await user1.requestFriend(user2)
        assert.equal(user1.getRelation(user2).status, "requested")
        assert.equal(user2.getRelation(user1).status, "pending")
    });
    it("should be able to retrieve incoming requests", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user2.requestFriend(user1)
        assert.equal(user1.getPending().length, 1)
    });
    it("should be able to retrieve outgoing requests", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        assert.equal(user1.getRequested().length, 1)
    });
    it("should be able to retrieve list of friends", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        await user2.acceptFriend(user1)
        assert.equal(user1.getFriends().length, 1)
    });
    it("should be able to retrieve list of blocked users", async () => {
        let user1 = await User.findOne({ name: 'John' })
        let user2 = await User.findOne({ name: 'Jane' })
        await user1.requestFriend(user2)
        await user2.blockUser(user1)
        assert.equal(user1.getBlocked().length, 1)
    });
});