"""one farmer, one field, one phone: devices, and the data of each field kept apart

Revision ID: 0008
Revises: 0007
"""
from alembic import op
import sqlalchemy as sa


revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None

# (table, old unique column, name PostgreSQL gave it in 0001/0004, new unique pair)
SWAPS = [("tasks", "key", "tasks_key_key", "uq_tasks_field_key", ["field_id", "key"]),
         ("alerts", "key", "alerts_key_key", "uq_alerts_field_key", ["field_id", "key"]),
         ("activities", "client_id", "activities_client_id_key", "uq_activities_field_client", ["field_id", "client_id"])]


def _swap_unique(table, col, pg_name, new_name, cols):
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        # SQLite cannot drop a constraint: the table is rebuilt. The old unique has no name, so the batch gives it one by convention.
        with op.batch_alter_table(table, naming_convention={"uq": "uq_%(table_name)s_%(column_0_name)s"}) as b:
            b.drop_constraint(f"uq_{table}_{col}", type_="unique")
            b.create_unique_constraint(new_name, cols)
    else:
        op.drop_constraint(pg_name, table, type_="unique")
        op.create_unique_constraint(new_name, table, cols)


def upgrade():
    op.create_table('devices',
        sa.Column('token_hash', sa.Text(), nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.Text(), nullable=False),
        sa.Column('last_seen', sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint('token_hash'))
    with op.batch_alter_table('alerts') as b:
        b.add_column(sa.Column('field_id', sa.Integer(), server_default='1', nullable=False))
    with op.batch_alter_table('offers') as b:
        b.add_column(sa.Column('field_id', sa.Integer(), server_default='1', nullable=False))
    with op.batch_alter_table('copilot_log') as b:
        b.add_column(sa.Column('field_id', sa.Integer(), server_default='1', nullable=False))
    for swap in SWAPS:
        _swap_unique(*swap)


def downgrade():
    for table, col, _pg, new_name, _cols in SWAPS:
        with op.batch_alter_table(table) as b:
            b.drop_constraint(new_name, type_="unique")
            b.create_unique_constraint(f"uq_{table}_{col}", [col])
    with op.batch_alter_table('copilot_log') as b:
        b.drop_column('field_id')
    with op.batch_alter_table('offers') as b:
        b.drop_column('field_id')
    with op.batch_alter_table('alerts') as b:
        b.drop_column('field_id')
    op.drop_table('devices')
