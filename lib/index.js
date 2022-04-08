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
        if (typeof user === 'string') {
            return (await this.constructor.findById(user));
        }
        return user;
    }

    // Returns all relations
    function getRelations() {
        return this.get(options.fieldName);
    };

    // Returns relation between two users
    function getRelation(user) {
        const relations = this.getRelations();
        return relations.find((relation) => user.equals(relation.user)) || null;
    };

    // Creates new relation between two users if it doesn't exist, returns new or existing relation.
    async function addRelation(user, status) {
        const userDoc = await this.fetchUser(user);
        if (!userDoc) {
            return null;
        }
        let relation = await this.getRelation(userDoc);
        if (!relation) {
            await this.get(options.fieldName).push({
                user: userDoc.id,
                status,
            });
        }
        return await this.getRelation(userDoc);
    }

    // Removes relation between two users
    async function removeRelation(user) {
        const userDoc = await this.fetchUser(user);
        if (!userDoc) {
            return;
        }
        const relation = this.getRelation(user);
        if (relation) {
            await this[options.fieldName].pull(relation);
        }
        const otherRelation = userDoc.getRelation(this);
        if (otherRelation) {
            await userDoc[options.fieldName].pull(otherRelation);
        }
    }

    // Update relation between two users
    function updateRelation(user, status) {
        const relation = this.getRelation(user);
        if (relation) {
            relation.status = status;
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
        let relation = this.getRelation(userDoc);
        if (relation === null) {
            relation = await this.addRelation(user, Status.Requested);
            await userDoc.addRelation(this, Status.Pending);
            return relation;
        }
        if (relation.status === Status.Pending) {
            await this.updateRelation(user, Status.Accepted);
            await userDoc.updateRelation(this, Status.Accepted);
        }
        return relation;
    }

    // Aliases for requestFriend
    schema.methods.acceptFriend = schema.methods.requestFriend;
    schema.methods.addFriend = schema.methods.addFriend;

    // Removes friend, cancels friend request if pending.
    schema.methods.removeFriend = async function removeFriend(user) {
        const relation = this.getRelation(user);
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
        let relation = this.getRelation(userDoc);
        if (relation !== null) {
            this.updateRelation(user, Status.Blocked);
            userDoc.updateRelation(this, Status.Blocked);
        } else {
            relation = await this.addRelation(userDoc, Status.Blocked);
            await userDoc.addRelation(this, Status.Blocked);
        }
        return relation;
    }

    // Unblock user
    schema.methods.unblockUser = function unblockUser(user) {
        let relation = this.getRelation(user);
        if (relation && relation.status === Status.Blocked) {
            this.removeRelation(user);
        }
    }

    // Returns outgoing/requested friend requests
    schema.methods.getRequested = function getRequested() {
        return this[options.fieldName].filter(relation => relation.status === Status.Requested);
    }

    // Returns incoming/pending friend requests
    schema.methods.getPending = function getPending() {
        return this[options.fieldName].filter(relation => relation.status === Status.Pending);
    }

    // Returns accepted friend requests
    schema.methods.getAccepted = function getAccepted() {
        return this[options.fieldName].filter(relation => relation.status === Status.Accepted);
    }

    // Alias for getAccepted
    schema.methods.getFriends = function getFriends() {
        return this.getAccepted();
    }

    // Returns blocked users
    schema.methods.getBlocked = function getBlocked() {
        return this[options.fieldName].filter(relation => relation.status === Status.Blocked);
    }
};