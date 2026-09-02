import psycopg2
conn = psycopg2.connect("postgresql://app_user:B6XRri3ev458GMUPyfOk@localhost:5434/app_db")
cur = conn.cursor()
cur.execute(open("/tmp/004_auto_replies.sql").read())
conn.commit()
print("Migration 004 applied successfully")
cur.close()
conn.close()
