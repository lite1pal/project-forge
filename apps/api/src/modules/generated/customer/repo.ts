import type { CreateCustomerInput, CustomerRecord, ListCustomersInput, UpdateCustomerInput } from "@auditrail/domain/generated/customer";

export interface CustomerRepo {
  create(input: { organizationId: string; data: CreateCustomerInput }): Promise<CustomerRecord>;
  findById(input: { id: string; organizationId: string }): Promise<CustomerRecord | undefined>;
  list(input: { organizationId: string; filters: ListCustomersInput }): Promise<readonly CustomerRecord[]>;
  update(input: { id: string; organizationId: string; data: UpdateCustomerInput }): Promise<CustomerRecord | undefined>;
}
