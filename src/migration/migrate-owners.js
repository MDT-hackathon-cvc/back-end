const { MongoClient, ObjectId } = require('mongodb');
const _ = require('lodash');
const url = 'mongodb://10.2.12.14:27017/brillianz?directConnection=true&ssl=false';

const clientPlatform = new MongoClient(url);

async function migrateOwners() {
    await clientPlatform.connect();
    const dbBrillianz = clientPlatform.db('brillianz');
    const nfts = dbBrillianz.collection('nfts');
    const owners = dbBrillianz.collection('owners');
    const ownerReads = await nfts.aggregate([
        {$unwind: "$owners"}
    ]).toArray();
    let lsOwner = [];
    for(let owner of ownerReads){
        const ownerClone = _.cloneDeep(owner.owners);
        ownerClone.nftId = owner._id;
        ownerClone.nft = {_id: owner._id, name: owner.name, code: owner.code, image: owner.image, noOfShare: owner.noOfShare };
        lsOwner.push(ownerClone);
    }
    if(lsOwner.length){
        console.log('lsOwners length: ', lsOwner.length);
        await owners.insertMany(lsOwner);
    }
}

migrateOwners()
    .then(console.log('finish'))
    .catch(console.error)
    .finally(() => {
        clientPlatform.close();
    });
