const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Please set MONGO_URI environment variable and try again.');
    process.exit(1);
  }

  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    console.log('Connected to MongoDB (raw driver)');

    const db = client.db(); // uses DB from connection string if present
    const q = process.argv[2] || 'krishika';
    console.log(`Searching for users matching: ${q}`);

    const users = await db.collection('users').find({
      $or: [
        { email: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } }
      ]
    }).toArray();

    if (!users || users.length === 0) {
      console.log('No matching users found.');
    } else {
      console.log(`Found ${users.length} user(s):`);
      users.forEach(u => {
        console.log('---');
        console.log('_id:', u._id.toString());
        console.log('email:', u.email);
        console.log('name/firstName:', u.name || u.firstName || '<none>');
        console.log('role:', u.role);
        console.log('password (raw):', u.password ? String(u.password).slice(0, 100) : '<none>');
      });
    }

    await client.close();
    process.exit(0);
  } catch (err) {
    console.error('Error querying users:', err);
    process.exit(1);
  }
}

main();
