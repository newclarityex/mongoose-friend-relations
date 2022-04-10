const defaultOptions = {
    fieldName: 'relations',
    index: true,
};

const Status = {
    Pending: 'pending',
    Requested: 'requested',
    Accepted: 'accepted',
    Blocked: 'blocked',
}

module.exports = function friendsPlugin(schema, options) {
    options = { ...defaultOptions, ...options };

    schema.add({
        [options.fieldName]: { type: Array }
    });

    if (options.index) {
        schema.index({
            [options.fieldName]: 1,
        });
    }

    // Converts Id to document if it is not already
    async function fetchUser(user) {
        if (user.relations) return user;
        return await this.constructor.findById(user);
    }

    // Returns all relations
    function getRelations() {
        return this.get(options.fieldName);
    };

    // Returns relation between two users
    async function getRelation(user) {
        const selfDoc = await this.fetchUser(this);
        const relations = selfDoc.getRelations();
        return relations.find((relation) => user.equals(relation.user)) || null;
    };

    // Creates new relation between two users if it doesn't exist, returns new or existing relation.
    async function addRelation(user, status) {
        const selfDoc = await this.fetchUser(this);
        const userDoc = await this.fetchUser(user);
        if (!userDoc) {
            return null;
        }
        let relation = await selfDoc.getRelation(userDoc);
        if (!relation) {
            await selfDoc.get(options.fieldName).push({
                user: userDoc.id,
                status,
            });
            await selfDoc.save();
        }
        return await selfDoc.getRelation(userDoc);
    }

    // Removes relation between two users
    async function removeRelation(user) {
        const selfDoc = await this.fetchUser(this);
        const userDoc = await this.fetchUser(user);
        if (!userDoc) {
            return;
        }
        const relation = await selfDoc.getRelation(user);
        if (relation) {
            await selfDoc[options.fieldName].pull(relation);
            await selfDoc.save();
        }
        const otherRelation = await userDoc.getRelation(selfDoc);
        if (otherRelation) {
            await userDoc[options.fieldName].pull(otherRelation);
            await userDoc.save();
        }
    }

    // Update relation between two users
    async function updateRelation(user, status) {
        const selfDoc = await this.fetchUser(this);
        const relation = await selfDoc.getRelation(user);
        if (relation) {
            relation.status = status;
            await selfDoc.save();
        }
        return relation;
    }


    // Exposes methods to the model
    schema.methods.fetchUser = fetchUser;
    schema.methods.getRelations = getRelations;
    schema.methods.getRelation = getRelation;
    schema.methods.addRelation = addRelation;
    schema.methods.addRelation = addRelation;
    schema.methods.removeRelation = removeRelation;
    schema.methods.updateRelation = updateRelation;

    // Create friend request, accepts friend request if pending.
    schema.methods.requestFriend = async function requestFriend(user) {
        const userDoc = await this.fetchUser(user);
        if (!userDoc) {
            return;
        }
        let relation = await this.getRelation(userDoc);
        if (relation === null) {
            relation = await this.addRelation(user, Status.Requested);
            await userDoc.addRelation(this, Status.Pending);
            return relation;
        }
        if (relation.status === Status.Pending) {
            await this.updateRelation(user, Status.Accepted);
            await userDoc.updateRelation(this, Status.Accepted);
        }
        return await this.getRelation(userDoc);
    }

    // Aliases for requestFriend
    schema.methods.acceptFriend = schema.methods.requestFriend;
    schema.methods.addFriend = schema.methods.addFriend;

    // Removes friend, cancels friend request if pending.
    schema.methods.removeFriend = async function removeFriend(user) {
        const relation = await this.getRelation(user);
        if (relation && (relation.status === Status.Pending || relation.status === Status.Accepted)) {
            await this.removeRelation(user);
        }
    }

    // Alias for removeFriend
    schema.methods.denyFriend = schema.methods.removeFriend;

    // Block user
    schema.methods.blockUser = async function blockUser(user) {
        const userDoc = await this.fetchUser(user);
        if (!userDoc) {
            return;
        }
        let relation = await this.getRelation(userDoc);
        if (relation !== null) {
            await this.updateRelation(user, Status.Blocked);
            await userDoc.updateRelation(this, Status.Blocked);
        } else {
            relation = await this.addRelation(userDoc, Status.Blocked);
            await userDoc.addRelation(this, Status.Blocked);
        }
        return relation;
    }

    // Unblock user
    schema.methods.unblockUser = async function unblockUser(user) {
        let relation = await this.getRelation(user);
        if (relation && relation.status === Status.Blocked) {
            await this.removeRelation(user);
        }
    }

    // Returns outgoing/requested friend requests
    schema.methods.getRequested = async function getRequested() {
        const relations = await this.getRelations();
        return relations.filter((relation) => relation.status === Status.Requested);
    }

    // Returns incoming/pending friend requests
    schema.methods.getPending = async function getPending() {
        const relations = await this.getRelations();
        return relations.filter(relation => relation.status === Status.Pending);
    }

    // Returns accepted friend requests
    schema.methods.getAccepted = async function getAccepted() {
        const relations = await this.getRelations();
        return relations.filter(relation => relation.status === Status.Accepted);
    }

    // Alias for getAccepted
    schema.methods.getFriends = async function getFriends() {
        return await this.getAccepted();
    }

    // Returns blocked users
    schema.methods.getBlocked = async function getBlocked() {
        const relations = await this.getRelations();
        return relations.filter(relation => relation.status === Status.Blocked);
    }
};