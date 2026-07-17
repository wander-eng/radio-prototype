export class MeleeAttackToken {
    private owner: string | null = null;

    public get ownerId(): string | null {
        return this.owner;
    }

    public tryAcquire(meleeId: string): boolean {
        if (this.owner !== null && this.owner !== meleeId) return false;
        this.owner = meleeId;
        return true;
    }

    public release(meleeId: string): boolean {
        if (this.owner !== meleeId) return false;
        this.owner = null;
        return true;
    }

    public clear() {
        this.owner = null;
    }
}
