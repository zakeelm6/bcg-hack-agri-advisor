"""task verification status (Phase 4)

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa


revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('tasks') as b:
        b.add_column(sa.Column('verify_status', sa.Text(), server_default='verified', nullable=False))
        b.add_column(sa.Column('verify_detail', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('tasks') as b:
        b.drop_column('verify_detail')
        b.drop_column('verify_status')
