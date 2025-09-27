ariable "aws_region" {
   description = "AWS region"
   type        = string
   default     = "ap-southeast-2"
 }
 
 variable "qut_username" {
   description = "n11857374"
   type        = string
   validation {
     condition     = can(regex("^n[0-9]{7}$", var.qut_username))
     error_message = "QUT username must be in format n1234567."
   }
 }
 
 variable "project_name" {
   description = "cab432-task-manager"
   type        = string
   default     = "cab432-task-manager"
 }

