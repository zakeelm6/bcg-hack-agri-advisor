"""farmer setup: sensors, connection, advisor phone, view mode (Phase 4b)

Revision ID: 0009
Revises: 0008
"""
from alembic import op
import sqlalchemy as sa


revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('farmers') as b:
        b.add_column(sa.Column('has_sensors', sa.Text(), nullable=True))
        b.add_column(sa.Column('connection', sa.Text(), nullable=True))
        b.add_column(sa.Column('advisor_phone', sa.Text(), nullable=True))
        b.add_column(sa.Column('mode', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('farmers') as b:
        for c in ('mode', 'advisor_phone', 'connection', 'has_sensors'):
            b.drop_column(c)
