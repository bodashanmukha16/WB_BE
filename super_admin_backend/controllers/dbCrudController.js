import mongoose from 'mongoose';

/**
 * 4. Database CRUD Operations via UI
 */

/**
 * List all available tenant databases and their collections
 */
export const getDatabasesAndCollections = async (req, res) => {
  try {
    const admin = mongoose.connection.db.admin();
    const { databases } = await admin.listDatabases();

    // Filter relevant workbench databases
    const wbDatabases = databases.filter(
      d => d.name.startsWith('wb_org_') || d.name === 'wb_super_admin' || d.name === 'DB1'
    );

    const result = [];
    for (const dbInfo of wbDatabases) {
      const dbInstance = mongoose.connection.useDb(dbInfo.name, { useCache: true });
      const collections = await dbInstance.db.listCollections().toArray();
      result.push({
        dbName: dbInfo.name,
        sizeOnDisk: dbInfo.sizeOnDisk,
        sizeMB: (dbInfo.sizeOnDisk / (1024 * 1024)).toFixed(2),
        collections: collections.map(c => c.name).sort()
      });
    }

    res.status(200).json({ success: true, databases: result });
  } catch (error) {
    console.error('getDatabasesAndCollections error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Documents from a specified Database & Collection
 */
export const getCollectionDocuments = async (req, res) => {
  try {
    const { dbName, collectionName } = req.params;
    const { filter = '{}', page = 1, limit = 20, search } = req.query;

    if (!dbName || !collectionName) {
      return res.status(400).json({ success: false, message: 'Database name and collection name are required.' });
    }

    const dbInstance = mongoose.connection.useDb(dbName, { useCache: true });
    const collection = dbInstance.db.collection(collectionName);

    let queryObj = {};
    try {
      queryObj = JSON.parse(filter);
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid JSON filter string.' });
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      queryObj.$or = [
        { username: searchRegex },
        { fullname: searchRegex },
        { email: searchRegex },
        { title: searchRegex },
        { subject: searchRegex },
        { name: searchRegex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalCount = await collection.countDocuments(queryObj);
    const documents = await collection
      .find(queryObj)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    res.status(200).json({
      success: true,
      dbName,
      collectionName,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      documents
    });
  } catch (error) {
    console.error('getCollectionDocuments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create a new Document in specified Database & Collection
 */
export const createDocument = async (req, res) => {
  try {
    const { dbName, collectionName } = req.params;
    const documentData = req.body;

    if (!dbName || !collectionName || !documentData) {
      return res.status(400).json({ success: false, message: 'Database name, collection name, and document data are required.' });
    }

    const dbInstance = mongoose.connection.useDb(dbName, { useCache: true });
    const collection = dbInstance.db.collection(collectionName);

    // Auto-add createdAt if not present
    if (!documentData.createdAt) {
      documentData.createdAt = new Date();
    }

    const result = await collection.insertOne(documentData);

    res.status(201).json({
      success: true,
      message: 'Document successfully inserted into database.',
      insertedId: result.insertedId
    });
  } catch (error) {
    console.error('createDocument error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update an existing Document by ID in specified Database & Collection
 */
export const updateDocument = async (req, res) => {
  try {
    const { dbName, collectionName, id } = req.params;
    const updateData = req.body;

    if (!dbName || !collectionName || !id) {
      return res.status(400).json({ success: false, message: 'Database name, collection name, and document ID are required.' });
    }

    const dbInstance = mongoose.connection.useDb(dbName, { useCache: true });
    const collection = dbInstance.db.collection(collectionName);

    // Parse ID (ObjectId or String)
    let queryId = id;
    if (mongoose.Types.ObjectId.isValid(id)) {
      queryId = new mongoose.Types.ObjectId(id);
    }

    // Remove _id from payload to avoid immutable field error
    delete updateData._id;

    // Add updatedAt timestamp
    updateData.updatedAt = new Date();

    const result = await collection.updateOne(
      { $or: [{ _id: queryId }, { _id: id }, { username: id }, { staffId: id }] },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: `Document with ID '${id}' not found.` });
    }

    res.status(200).json({
      success: true,
      message: 'Document updated successfully.',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('updateDocument error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete a Document by ID from specified Database & Collection
 */
export const deleteDocument = async (req, res) => {
  try {
    const { dbName, collectionName, id } = req.params;

    if (!dbName || !collectionName || !id) {
      return res.status(400).json({ success: false, message: 'Database name, collection name, and document ID are required.' });
    }

    const dbInstance = mongoose.connection.useDb(dbName, { useCache: true });
    const collection = dbInstance.db.collection(collectionName);

    let queryId = id;
    if (mongoose.Types.ObjectId.isValid(id)) {
      queryId = new mongoose.Types.ObjectId(id);
    }

    const result = await collection.deleteOne({
      $or: [{ _id: queryId }, { _id: id }, { username: id }, { staffId: id }]
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: `Document with ID '${id}' not found.` });
    }

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully from database.',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('deleteDocument error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
