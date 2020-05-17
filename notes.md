Notes to remind myself about various things.

### Getting the CouchDB database

Download the `.couch` file from `/var/lib/couchdb`. The server runs CouchDB 1.6. It's hard to install this version anymore, so install 2.1.

To import the backup file into 2.1:
- Stop the server
- Edit `/opt/couchdb/etc/vm.args`
- Change the node name from `couchdb@127.0.0.1` to `couchdb@localhost` (to make 2.1 able to read old database files)
- Copy the database backup file to `/var/lib/couchdb`
- Start the server
- The database is now available at `http://localhost:5986/_utils` - note the port number, the database is NOT available on the stardard port, at `http://127.0.0.1:5984/_utils`

See also:
- https://stackoverflow.com/questions/40631424/couchdb-data-migration-from-1-4-to-2-0
- https://blog.couchdb.org/2016/08/17/migrating-to-couchdb-2-0/
- https://docs.couchdb.org/en/stable/whatsnew/2.1.html
